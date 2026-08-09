import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from '@/config'
import type { AgeGroup } from '@/types'
import type { ImageProvider, TextProvider, WordContent } from './types'
import {
  wordContentSystemPrompt, wordContentUserPrompt, parseWordContent,
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
      const result = await model.generateContent(user, {
        timeout: config.network.requestTimeoutMs,
      })
      return result.response.text()
    } catch {
      // Rate limit, network failure, safety block. All are the same to the
      // caller: this optional step did not produce anything.
      return null
    }
  }

  async generateWordContent(
    word: string,
    rawDefinition: string,
    ageGroup: AgeGroup,
    sceneCount: number,
  ): Promise<WordContent | null> {
    const raw = await this.generate(
      wordContentSystemPrompt(ageGroup, sceneCount),
      wordContentUserPrompt(word, rawDefinition, ageGroup, sceneCount),
    )
    if (!raw) return null
    return parseWordContent(raw, word, sceneCount)
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
      const result = await model.generateContent(prompt, {
        timeout: config.network.requestTimeoutMs,
      })

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
