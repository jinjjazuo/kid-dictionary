import { config } from '@/config'
import type { AgeGroup } from '@/types'
import type { TextProvider, WordContent } from './types'
import {
  wordContentSystemPrompt, wordContentUserPrompt, parseWordContent,
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
        signal: AbortSignal.timeout(config.network.requestTimeoutMs),
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.choices?.[0]?.message?.content ?? null
    } catch {
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
