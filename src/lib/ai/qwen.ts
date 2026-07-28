import { config } from '@/config'
import type { AgeGroup, Scene } from '@/types'
import type { Enrichment, TextProvider } from './types'
import {
  enrichSystemPrompt, enrichUserPrompt,
  storySystemPrompt, storyUserPrompt,
  parseJsonResponse, keepExamplesUsingWord,
} from './prompts'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * Text generation via Qwen on OpenRouter.
 *
 * Uses the OpenAI-compatible chat completions API directly rather than an SDK
 * — one fetch call is smaller than a dependency. The structured-output
 * parameter differs from Gemini's (`response_format` rather than
 * `responseMimeType`), which is the main reason the adapters are separate.
 *
 * There is no Qwen image provider. Its image generation handles multi-panel
 * layout and cross-panel character consistency less reliably, so comics stay
 * on Gemini regardless of the text provider.
 */
export class QwenTextProvider implements TextProvider {
  constructor(private apiKey: string) {}

  private async generate(system: string, user: string): Promise<string | null> {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.ai.qwen.textModel,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_object' },
        }),
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.choices?.[0]?.message?.content ?? null
    } catch {
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

    // json_object mode forbids a bare array at the top level, so Qwen wraps
    // it. Accept either shape.
    const parsed = parseJsonResponse<Scene[] | { scenes?: Scene[] }>(raw)
    const scenes = Array.isArray(parsed) ? parsed : parsed?.scenes
    if (!Array.isArray(scenes)) return null
    if (scenes.length !== sceneCount) return null
    if (!scenes.every(s => typeof s?.text === 'string' && s.text.length > 0)) return null

    return scenes.map((s, i) => ({ scene: i + 1, text: s.text }))
  }
}
