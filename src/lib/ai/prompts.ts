import { config } from '@/config'
import type { AgeGroup, Scene } from '@/types'
import type { WordContent } from './types'

/**
 * Every prompt in the application, shared by all providers rather than
 * duplicated per adapter.
 *
 * Gemini and Qwen both accept plain instructions, so per-model divergence is
 * speculation until demonstrated. This file is also what
 * `config.content.textVersion` gates — bump that version whenever a change
 * here should regenerate cached content.
 */

const AGE_DESCRIPTIONS: Record<AgeGroup, string> = {
  '4-6': 'a 5-year-old child who is just learning to read',
  '7-10': 'a 9-year-old child who reads independently',
}

/**
 * Sets the rules for the single combined content call: definition, examples
 * and (when `sceneCount > 0`) the comic script, in one response.
 *
 * Combined because the provider's free tier is metered per request — one call
 * instead of two doubles the daily new-word capacity.
 *
 * The vocabulary ceiling is explicit because "use simple words" is not
 * reliable — models routinely reach for a harder word when it is more
 * precise. In the story, two constraints carry the pedagogy: the word must
 * appear in every scene's text, and the meaning must be inferable from the
 * scenes alone.
 *
 * `sceneCount: 0` (sensitive words) omits the story section entirely, so the
 * model is never asked to illustrate what the app will not show.
 */
export function wordContentSystemPrompt(ageGroup: AgeGroup, sceneCount: number): string {
  const audience = AGE_DESCRIPTIONS[ageGroup]
  const sentences = ageGroup === '4-6' ? 'exactly one short sentence' : 'one or two sentences'

  const definitionRules = `You write dictionary entries for ${audience}.

Rules:
- Use only words that ${audience} already knows. If you need a harder word to be precise, rephrase instead — never reach for the harder word.
- Write the definition as ${sentences}. The definition must not contain the word being defined.
- Write exactly ${config.word.maxExamples} example sentences. Every example sentence MUST contain the word being defined, spelled exactly as given. The examples are how the child learns to use the word — an example that avoids the word, or replaces it with an easier synonym, is useless and must not be written.
- Each example must show the word doing its job, so that a child who did not read the definition could still guess what it means from the sentence.
- Set every example in a child's own world: home, school, playground, family, animals, food, weather.
- Keep it warm and plain. No jokes that need adult knowledge.

For the word "enormous", these are the shapes to follow and avoid:
GOOD: "The elephant at the zoo was enormous." — uses the word, and the setting hints at the meaning.
BAD: "The dog is so big and tall." — the word never appears, so the child learns nothing.`

  if (sceneCount === 0) {
    return `${definitionRules}

Respond with JSON only, in this exact shape:
{"definition": "...", "examples": ["...", "..."]}`
  }

  return `${definitionRules}

You also write a short picture-book story for the same word, as numbered scenes:
- Every scene must use the word naturally in its text. A story that never uses the word teaches nothing.
- The scenes together must make the word's meaning obvious from context alone, without the definition.
- Use the same character in every scene so the panels read as one story.
- One or two short sentences per scene.
- Nothing scary, violent, sad or unsettling. No danger, injury, or characters in distress.
- Describe what can be seen. The scenes become drawings.

Respond with JSON only, in this exact shape:
{"definition": "...", "examples": ["...", "..."], "scenes": [{"scene": 1, "text": "..."}, {"scene": 2, "text": "..."}]}`
}

export function wordContentUserPrompt(
  word: string,
  rawDefinition: string,
  ageGroup: AgeGroup,
  sceneCount: number,
): string {
  const base = `Word: "${word}"
Dictionary definition: "${rawDefinition}"

Rewrite this for ${AGE_DESCRIPTIONS[ageGroup]}.`

  if (sceneCount === 0) return base

  return `${base}
Also write a ${sceneCount}-scene story that teaches the word "${word}".`
}

/**
 * Validates a combined-call response into a WordContent, shared by every
 * adapter so the shape rules live in one place.
 *
 * The definition is load-bearing: without it the response is worthless and
 * the whole call fails (null). The story is not: a bad script only nulls
 * `scenes`, keeping the text, because throwing away a good definition over a
 * bad story would double the failure rate of the combined call.
 *
 * A script of the wrong length is unusable — the panel highlight overlay
 * divides the image into `sceneCount` equal columns, so a mismatch would
 * misalign every panel.
 */
export function parseWordContent(
  raw: string,
  word: string,
  sceneCount: number,
): WordContent | null {
  const parsed = parseJsonResponse<{
    definition?: string
    examples?: string[]
    scenes?: Scene[]
  }>(raw)
  if (!parsed?.definition) return null

  // Examples that never use the word teach nothing, so they are dropped
  // rather than shown. Filtering before the slice keeps a good example that
  // the model listed after a bad one.
  const examples = Array.isArray(parsed.examples)
    ? keepExamplesUsingWord(parsed.examples, word).slice(0, config.word.maxExamples)
    : []

  return {
    definition: parsed.definition,
    examples,
    scenes: validateScenes(parsed.scenes, sceneCount),
  }
}

function validateScenes(scenes: Scene[] | undefined, sceneCount: number): Scene[] | null {
  // No story requested: whatever the model sent must not become a comic.
  if (sceneCount === 0) return []

  if (!Array.isArray(scenes)) return null
  if (scenes.length !== sceneCount) return null
  if (!scenes.every(s => typeof s?.text === 'string' && s.text.length > 0)) return null

  return scenes.map((s, i) => ({ scene: i + 1, text: s.text }))
}

/**
 * Assembles the image prompt from the script.
 *
 * Built here rather than generated by a model so the style clause and the
 * panel count are identical for every comic in the app. The panel count must
 * be explicit or the model produces an arbitrary number and the picture stops
 * matching the script.
 */
export function buildImagePrompt(scenes: Scene[]): string {
  const panels = scenes
    .map(s => `Panel ${s.scene}: ${s.text}`)
    .join(' ')

  return `A children's comic strip with exactly ${scenes.length} equal-width panels side by side. ` +
    `Flat cartoon illustration, bright cheerful colours, thick clean outlines, simple friendly shapes. ` +
    `The same character appears in every panel. No text, no speech bubbles, no lettering anywhere. ` +
    panels
}

/**
 * Keeps only the examples that actually contain the word.
 *
 * The prompt demands the word verbatim, but models still paraphrase it away
 * ("The dog is so big" for "enormous"), and such a sentence teaches nothing.
 * Matching is case-insensitive and allows a suffix, so "enormously" and
 * "Enormous" both count, while a bare synonym does not.
 */
export function keepExamplesUsingWord(examples: string[], word: string): string[] {
  const stem = word.trim().toLowerCase()
  if (!stem) return []

  const pattern = new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*\\b`, 'i')
  return examples.filter(example => pattern.test(example))
}

/**
 * Extracts JSON from a model response.
 *
 * Models add markdown fences and conversational padding despite being told to
 * return raw JSON, so this falls back to locating the outermost bracket pair.
 * Returns null rather than throwing — the pipeline treats that as a normal
 * degradation, whereas a throw would fail the whole request.
 */
export function parseJsonResponse<T>(raw: string): T | null {
  if (!raw) return null

  const withoutFence = raw
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()

  try {
    return JSON.parse(withoutFence) as T
  } catch {
    // Fall through to bracket extraction.
  }

  const start = withoutFence.search(/[[{]/)
  if (start === -1) return null
  const opener = withoutFence[start]
  const closer = opener === '[' ? ']' : '}'
  const end = withoutFence.lastIndexOf(closer)
  if (end <= start) return null

  try {
    return JSON.parse(withoutFence.slice(start, end + 1)) as T
  } catch {
    return null
  }
}
