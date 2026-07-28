import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from '@/config'
import type { AgeGroup, Scene } from '@/types'
import type { Enrichment, ImageProvider, TextProvider } from './types'
import {
  enrichSystemPrompt, enrichUserPrompt,
  storySystemPrompt, storyUserPrompt,
  parseJsonResponse, keepExamplesUsingWord,
} from './prompts'

/**
 * Text generation via Gemini.
 *
 * `responseMimeType: 'application/json'` makes structured output far more
 * reliable but is not a guarantee, so every response still goes through
 * defensive parsing and shape validation.
 */
export class GeminiTextProvider implements TextProvider {
  private client: GoogleGenerativeAI

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey)
  }

  private async generate(system: string, user: string): Promise<string | null> {
    try {
      const model = this.client.getGenerativeModel({
        model: config.ai.gemini.textModel,
        systemInstruction: system,
        generationConfig: { responseMimeType: 'application/json' },
      })
      const result = await model.generateContent(user)
      return result.response.text()
    } catch {
      // Rate limit, network failure, safety block. All are the same to the
      // caller: this optional step did not produce anything.
      return null
    }
  }

  async enrichWord(
    word: string,
    rawDefinition: string,
    ageGroup: AgeGroup,
  ): Promise<Enrichment | null> {
    const raw = await this.generate(
      enrichSystemPrompt(ageGroup),
      enrichUserPrompt(word, rawDefinition, ageGroup),
    )
    if (!raw) return null

    const parsed = parseJsonResponse<Partial<Enrichment>>(raw)
    // Parseable but missing a definition is still a failure — caching a row
    // with no definition would serve an empty page forever.
    if (!parsed?.definition) return null

    // Examples that never use the word teach nothing, so they are dropped
    // rather than shown. Filtering before the slice keeps a good example that
    // the model listed after a bad one.
    return {
      definition: parsed.definition,
      examples: Array.isArray(parsed.examples)
        ? keepExamplesUsingWord(parsed.examples, word).slice(0, config.word.maxExamples)
        : [],
    }
  }

  async generateStory(
    word: string,
    ageGroup: AgeGroup,
    sceneCount: number,
  ): Promise<Scene[] | null> {
    const raw = await this.generate(
      storySystemPrompt(ageGroup),
      storyUserPrompt(word, sceneCount),
    )
    if (!raw) return null

    const parsed = parseJsonResponse<Scene[]>(raw)
    if (!Array.isArray(parsed)) return null
    // The panel highlight overlay divides the image into sceneCount equal
    // columns, so a script of a different length would misalign every panel.
    if (parsed.length !== sceneCount) return null
    if (!parsed.every(s => typeof s?.text === 'string' && s.text.length > 0)) return null

    return parsed.map((s, i) => ({ scene: i + 1, text: s.text }))
  }
}

/**
 * Comic generation via Gemini's image model.
 *
 * Returns raw bytes. Compression to WebP happens in the pipeline so the
 * provider stays ignorant of storage concerns.
 */
export class GeminiImageProvider implements ImageProvider {
  private client: GoogleGenerativeAI

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey)
  }

  async generateComic(prompt: string): Promise<Buffer | null> {
    try {
      const model = this.client.getGenerativeModel({ model: config.ai.gemini.imageModel })
      const result = await model.generateContent(prompt)

      const parts = result.response.candidates?.[0]?.content?.parts ?? []
      for (const part of parts) {
        const data = part.inlineData?.data
        if (data) return Buffer.from(data, 'base64')
      }
      return null
    } catch {
      return null
    }
  }
}
