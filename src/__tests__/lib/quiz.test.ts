import { describe, it, expect } from 'vitest'
import { generateQuizQuestions, buildQuestionFor } from '@/lib/quiz'
import type { SavedWord } from '@/lib/store/types'
import { config } from '@/config'

function makeWords(count: number): SavedWord[] {
  return Array.from({ length: count }, (_, i) => ({
    word: `word${i}`,
    definition: `Definition number ${i}.`,
    partOfSpeech: 'noun',
    examples: [],
    synonyms: [],
    phonetic: null,
    comicImageUrl: null,
    ageGroup: '4-6' as const,
    textVersion: 1,
    addedAt: new Date().toISOString(),
  }))
}

describe('generateQuizQuestions', () => {
  it('returns nothing below the minimum collection size', () => {
    expect(generateQuizQuestions(makeWords(config.games.minWordsRequired - 1))).toEqual([])
  })

  it('builds a full question at exactly the minimum', () => {
    // Four saved words leave exactly three others as wrong answers, which is
    // what a four-choice question needs. This is why no server-side source of
    // extra words is required.
    const questions = generateQuizQuestions(makeWords(config.games.minWordsRequired))
    expect(questions.length).toBeGreaterThan(0)
    expect(questions[0].choices).toHaveLength(config.games.mcqChoices)
  })

  it('caps the question count at the collection size', () => {
    // Repeating words to reach a fixed length would produce a literally
    // identical screen with the buttons shuffled, which reads as a bug.
    expect(generateQuizQuestions(makeWords(4))).toHaveLength(4)
    expect(generateQuizQuestions(makeWords(6))).toHaveLength(6)
  })

  it('never exceeds the configured question count', () => {
    expect(generateQuizQuestions(makeWords(50))).toHaveLength(config.games.quizQuestionCount)
  })

  it('asks each word at most once', () => {
    const prompts = generateQuizQuestions(makeWords(6)).map(q => q.prompt)
    expect(new Set(prompts).size).toBe(prompts.length)
  })

  it('points answerIndex at the correct choice in every question', () => {
    const words = makeWords(8)
    for (const question of generateQuizQuestions(words)) {
      const answer = question.choices[question.answerIndex]
      const source = words.find(w =>
        question.mode === 'word-to-meaning' ? w.word === question.prompt : w.definition === question.prompt
      )
      expect(source).toBeDefined()
      expect(answer).toBe(question.mode === 'word-to-meaning' ? source!.definition : source!.word)
    }
  })

  it('never repeats a choice within a question', () => {
    for (const question of generateQuizQuestions(makeWords(10))) {
      expect(new Set(question.choices).size).toBe(question.choices.length)
    }
  })

  it('uses both question modes across a long enough quiz', () => {
    const modes = new Set(generateQuizQuestions(makeWords(10)).map(q => q.mode))
    expect(modes.size).toBe(2)
  })
})

describe('buildQuestionFor', () => {
  it('builds a question about a specific word', () => {
    const words = makeWords(5)
    const question = buildQuestionFor(words[0], words)
    expect(question).not.toBeNull()
    expect(question!.choices).toContain(words[0].definition)
  })

  it('returns null when there are too few other words', () => {
    const words = makeWords(2)
    expect(buildQuestionFor(words[0], words)).toBeNull()
  })

  it('excludes the target from its own wrong answers', () => {
    const words = makeWords(5)
    const question = buildQuestionFor(words[0], words)!
    const occurrences = question.choices.filter(c => c === words[0].definition)
    expect(occurrences).toHaveLength(1)
  })
})
