/**
 * Words that must never reach an AI provider.
 *
 * Deliberately short. dictionaryapi.dev already rejects non-words, and the
 * prompts instruct age-appropriate treatment as a second layer, so this list
 * covers only what should not be sent at all.
 *
 * Extend rather than replace — entries are matched whole, never as substrings.
 */
export const BLOCKED_WORDS: readonly string[] = [
  'porn', 'pornography', 'sex', 'rape', 'incest', 'bestiality',
  'nude', 'nudity', 'orgasm', 'masturbate', 'masturbation',
  'whore', 'slut', 'faggot', 'nigger', 'retard',
]

/**
 * Real words with legitimate dictionary entries that should be explained but
 * not illustrated.
 *
 * A sentence explaining what "death" means is useful to a child who asked.
 * An illustrated cartoon about it is a different artefact, and not one this
 * app should generate unsupervised.
 */
export const SENSITIVE_WORDS: readonly string[] = [
  'death', 'die', 'died', 'dead', 'dying', 'kill', 'killed', 'murder',
  'war', 'weapon', 'gun', 'knife', 'bomb', 'bullet', 'shoot',
  'blood', 'wound', 'injury', 'suicide', 'drown',
  'cancer', 'disease', 'illness', 'sick', 'hospital', 'funeral', 'grave',
  'drug', 'drugs', 'alcohol', 'drunk', 'cigarette', 'smoking',
  'abuse', 'violence', 'violent', 'attack', 'fight', 'hurt', 'pain',
  'divorce', 'prison', 'jail', 'crime', 'steal', 'thief',
]
