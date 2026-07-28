import { BLOCKED_WORDS, SENSITIVE_WORDS } from './word-lists'

/**
 * - `allowed`   — definition, examples and comic
 * - `sensitive` — definition and examples, no comic
 * - `blocked`   — nothing; never sent to a model
 */
export type SafetyVerdict = 'allowed' | 'sensitive' | 'blocked'

/**
 * Classifies a looked-up word.
 *
 * Matching is on the whole normalised word, never a substring: "war" must not
 * make "warm", "reward" or "wardrobe" sensitive, and substring matching on a
 * blocklist produces exactly that class of false positive.
 *
 * Called before the cache is consulted for generation, so a blocked word costs
 * nothing and reaches no provider.
 */
export function checkWord(word: string): SafetyVerdict {
  const normalised = word.trim().toLowerCase()
  if (BLOCKED_WORDS.includes(normalised)) return 'blocked'
  if (SENSITIVE_WORDS.includes(normalised)) return 'sensitive'
  return 'allowed'
}
