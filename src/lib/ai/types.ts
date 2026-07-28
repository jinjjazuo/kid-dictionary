import type { AgeGroup, Scene } from '@/types'

/** Age-appropriate definition and examples, replacing the raw dictionary text. */
export type Enrichment = {
  definition: string
  examples: string[]
}

/**
 * Generates the written content for a word.
 *
 * Methods return null rather than throwing. Every AI step is optional and a
 * failure must degrade the page — a child should still get a definition when
 * the story generation fails.
 */
export interface TextProvider {
  enrichWord(word: string, rawDefinition: string, ageGroup: AgeGroup): Promise<Enrichment | null>
  generateStory(word: string, ageGroup: AgeGroup, sceneCount: number): Promise<Scene[] | null>
}

/** Draws the multi-panel comic. Returns raw bytes; compression happens later. */
export interface ImageProvider {
  generateComic(prompt: string): Promise<Buffer | null>
}
