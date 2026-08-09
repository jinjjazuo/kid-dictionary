import type { AgeGroup, Scene } from '@/types'

/**
 * Everything the text model produces for a word, from one call.
 *
 * Definition, examples and story script come back together because the
 * provider's free tier is metered per request — one combined call doubles how
 * many new words fit in the daily quota compared to separate enrich and story
 * calls.
 *
 * `scenes` distinguishes two non-story cases the pipeline treats differently:
 * `[]` means no story was requested (sensitive word — cache normally without
 * a comic), while `null` means a story was requested but the script was
 * unusable (do not cache, so a retry can succeed).
 */
export type WordContent = {
  definition: string
  examples: string[]
  scenes: Scene[] | null
}

/**
 * Generates the written content for a word.
 *
 * Returns null rather than throwing. Every AI step is optional and a failure
 * must degrade the page — a child should still get the raw dictionary
 * definition when generation fails.
 *
 * `sceneCount: 0` means "no story": the sensitive-word path, where the model
 * must not even be asked for scenes.
 */
export interface TextProvider {
  generateWordContent(
    word: string,
    rawDefinition: string,
    ageGroup: AgeGroup,
    sceneCount: number,
  ): Promise<WordContent | null>
}

/** Draws the multi-panel comic. Returns raw bytes; compression happens later. */
export interface ImageProvider {
  generateComic(prompt: string): Promise<Buffer | null>
}
