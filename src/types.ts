import type { AgeGroup } from '@/config'

export type { AgeGroup }

/**
 * Grammatical category from the dictionary source. Drives the colour of the badge
 * on a word card. Unrecognised values fall back to a neutral badge, so this
 * union does not need to be exhaustive.
 */
export type PartOfSpeech =
  | 'noun' | 'verb' | 'adjective' | 'adverb' | 'pronoun'
  | 'preposition' | 'conjunction' | 'interjection'

/** One panel of the comic: its number and the narration beneath it. */
export type Scene = {
  scene: number
  text: string
}

/** A fully generated word, as returned by the lookup pipeline. */
export type WordData = {
  id: string | null
  word: string
  ageGroup: AgeGroup
  definition: string
  partOfSpeech: string | null
  examples: string[]
  synonyms: string[]
  phonetic: string | null
  storyScript: Scene[]
  comicImageUrl: string | null
  /** Wiktionary recording of the word, hosted on Wikimedia. Null when none exists. */
  audioUrl: string | null
  textVersion: number
}

export type QuizMode = 'word-to-meaning' | 'meaning-to-word'

export type QuizQuestion = {
  mode: QuizMode
  /** The word or the definition, depending on mode. */
  prompt: string
  choices: string[]
  answerIndex: number
}

/** Raw data from dictionaryapi.dev, before any AI simplification. */
export type DictionaryApiResult = {
  phonetic: string | null
  partOfSpeech: string | null
  rawDefinition: string
  synonyms: string[]
  audioUrl: string | null
}
