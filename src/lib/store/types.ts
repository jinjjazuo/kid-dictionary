import type { AgeGroup } from '@/config'

/**
 * A word the user has collected.
 *
 * Content is stored in full rather than by reference so the collection renders
 * instantly and survives network failure. The failure modes are asymmetric: a
 * stale definition means slightly older wording nobody notices, whereas a
 * failed fetch with reference-only storage means a child opens their
 * collection and finds it empty.
 *
 * `textVersion` records which generation of prompts produced this copy, so
 * stale entries can be identified and refreshed later without regenerating
 * everything blindly.
 *
 * `comicImageUrl` is a URL, never image bytes. A base64 comic is roughly
 * 400 KB in UTF-16, which fills the 5 MB localStorage quota at about twelve
 * words.
 */
export type SavedWord = {
  /** Lowercase. The identity key — there is no separate id. */
  word: string
  definition: string
  partOfSpeech: string | null
  examples: string[]
  synonyms: string[]
  phonetic: string | null
  comicImageUrl: string | null
  ageGroup: AgeGroup
  textVersion: number
  /** ISO 8601. */
  addedAt: string
}

/**
 * Persistence for the user's word collection.
 *
 * Every method is async even though the localStorage implementation is
 * synchronous. This is deliberate: a future SupabaseWordStore will be
 * genuinely async, and matching that signature now means adding accounts
 * changes one factory function instead of every call site.
 *
 * There is no update() — add() is an upsert keyed on the word, which removes
 * partial-update semantics entirely.
 */
export interface WordStore {
  /** Newest first. */
  list(): Promise<SavedWord[]>
  /** Idempotent upsert on `word`. Moves an existing word to the front. */
  add(word: SavedWord): Promise<void>
  /** No-op when the word is absent. */
  remove(word: string): Promise<void>
  has(word: string): Promise<boolean>
  clear(): Promise<void>
}
