import { describe, it, expect } from 'vitest'
import { generateQuizQuestions } from '@/lib/quiz'
import type { UserWord } from '@/types'

const makeWord = (word: string, definition: string): UserWord => ({
  id: `id-${word}`, wordId: `wid-${word}`, word, definition,
  examples: [], synonyms: [], phonetic: null,
  pronunciationUrl: null, comicImageUrl: null, addedAt: new Date().toISOString()
})

const fourWords = [
  makeWord('enormous', 'Very big'),
  makeWord('swift', 'Very fast'),
  makeWord('brave', 'Not afraid'),
  makeWord('gentle', 'Soft and kind'),
]

describe('generateQuizQuestions', () => {
  it('generates questions from saved words', () => {
    const questions = generateQuizQuestions(fourWords, 4)
    expect(questions).toHaveLength(4)
  })

  it('each question has 4 choices', () => {
    const questions = generateQuizQuestions(fourWords, 2)
    for (const q of questions) {
      expect(q.choices).toHaveLength(4)
    }
  })

  it('correct answer is always in choices', () => {
    const questions = generateQuizQuestions(fourWords, 10)
    for (const q of questions) {
      expect(q.choices[q.answerIndex]).toBeDefined()
    }
  })

  it('both question modes are used across enough questions', () => {
    const questions = generateQuizQuestions(fourWords, 20)
    const modes = new Set(questions.map(q => q.mode))
    expect(modes.size).toBe(2)
  })
})
