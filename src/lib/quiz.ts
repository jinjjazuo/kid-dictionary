import { config } from '@/config'
import type { SavedWord } from '@/lib/store/types'
import type { QuizMode, QuizQuestion } from '@/types'

/**
 * Builds one multiple-choice question about a specific word.
 *
 * Wrong answers come only from the user's other saved words. At the minimum
 * collection size of four, removing the target leaves exactly three others —
 * precisely what a four-choice question needs, which is why the quiz needs no
 * server-side source of extra vocabulary.
 *
 * Returns null when the pool cannot supply enough wrong answers.
 */
export function buildQuestionFor(
  target: SavedWord,
  pool: SavedWord[],
  mode: QuizMode = 'word-to-meaning',
): QuizQuestion | null {
  const others = pool.filter(w => w.word.toLowerCase() !== target.word.toLowerCase())
  const needed = config.games.mcqChoices - 1
  if (others.length < needed) return null

  const distractors = shuffle(others).slice(0, needed)

  const correct = mode === 'word-to-meaning' ? target.definition : target.word
  const wrong = distractors.map(w => (mode === 'word-to-meaning' ? w.definition : w.word))

  // Shuffled so the correct answer does not sit in the same position every
  // time — with a small collection the choices repeat, and a fixed position
  // would make the quiz trivially guessable.
  const choices = shuffle([correct, ...wrong])

  return {
    mode,
    prompt: mode === 'word-to-meaning' ? target.word : target.definition,
    choices,
    answerIndex: choices.indexOf(correct),
  }
}

/**
 * Builds a quiz from the user's collection.
 *
 * The question count is capped at the collection size rather than repeating
 * words to reach a fixed length. With only four saved words there are only
 * three possible wrong answers, so a repeated word produces a literally
 * identical screen with the buttons shuffled — that reads as a bug rather
 * than as revision. A short quiz that ends deliberately is better than a long
 * one that visibly loops.
 */
export function generateQuizQuestions(
  words: SavedWord[],
  count: number = config.games.quizQuestionCount,
): QuizQuestion[] {
  if (words.length < config.games.minWordsRequired) return []

  const targets = shuffle(words).slice(0, Math.min(count, words.length))

  return targets
    .map((target, i) =>
      // Alternate modes so a quiz always mixes both directions rather than
      // landing on one by chance.
      buildQuestionFor(target, words, i % 2 === 0 ? 'word-to-meaning' : 'meaning-to-word'),
    )
    .filter((q): q is QuizQuestion => q !== null)
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
