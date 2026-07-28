import { LocalWordStore } from './local-store'
import type { WordStore } from './types'

export type { SavedWord, WordStore } from './types'
export { LocalWordStore } from './local-store'

/**
 * Returns the active word store.
 *
 * This function is the entire seam for adding accounts later. It becomes
 * `user ? new SupabaseWordStore(user.id) : new LocalWordStore()`, and nothing
 * that consumes a WordStore has to change.
 */
export function getWordStore(): WordStore {
  return new LocalWordStore()
}
