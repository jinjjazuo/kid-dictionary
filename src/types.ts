import type { AgeGroup } from '@/config'

export type { AgeGroup }

export type Scene = {
  scene: number  // 1-indexed panel number
  text: string   // narration text for this panel
}

export type WordData = {
  id: string
  word: string
  ageGroup: AgeGroup
  definition: string
  examples: string[]
  synonyms: string[]
  phonetic: string | null
  pronunciationUrl: string | null
  storyScript: Scene[]
  comicImageUrl: string | null
}

export type UserWord = {
  id: string           // user_words.id
  wordId: string       // words.id
  word: string
  definition: string
  examples: string[]
  synonyms: string[]
  phonetic: string | null
  pronunciationUrl: string | null
  comicImageUrl: string | null
  addedAt: string      // ISO timestamp
}

export type QuizQuestion = {
  mode: 'word-to-meaning' | 'meaning-to-word'
  prompt: string       // the word or definition shown
  choices: string[]    // 4 options
  answerIndex: number  // index of correct choice
}

export type DictionaryApiResult = {
  phonetic: string | null
  pronunciationUrl: string | null
  rawDefinition: string
  synonyms: string[]
}
