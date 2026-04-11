import { config } from '@/config'
import type { UserWord, QuizQuestion } from '@/types'

export function generateQuizQuestions(
  savedWords: UserWord[],
  count: number,
  globalWords: UserWord[] = []
): QuizQuestion[] {
  if (savedWords.length < config.games.minWordsRequired) return []

  const allWords = [
    ...savedWords,
    ...globalWords.filter(g => !savedWords.some(s => s.wordId === g.wordId))
  ]

  const questions: QuizQuestion[] = []
  const wordPool = [...savedWords]

  for (let i = 0; i < count; i++) {
    const correct = wordPool[i % wordPool.length]
    const mode: QuizQuestion['mode'] = i % 2 === 0 ? 'word-to-meaning' : 'meaning-to-word'

    const others = allWords.filter(w => w.wordId !== correct.wordId)
    const distractors = shuffle(others).slice(0, config.games.mcqChoices - 1)

    const wrongChoices = mode === 'word-to-meaning'
      ? distractors.map(w => w.definition)
      : distractors.map(w => w.word)

    const correctChoice = mode === 'word-to-meaning' ? correct.definition : correct.word

    const choices = shuffle([correctChoice, ...wrongChoices]).slice(0, config.games.mcqChoices)
    const answerIndex = choices.indexOf(correctChoice)

    questions.push({
      mode,
      prompt: mode === 'word-to-meaning' ? correct.word : correct.definition,
      choices,
      answerIndex,
    })
  }

  return questions
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
