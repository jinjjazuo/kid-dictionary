import { config } from '@/config'
import { GeminiImageProvider, GeminiTextProvider } from './gemini'
import { QwenTextProvider } from './qwen'
import type { ImageProvider, TextProvider } from './types'

export type { ImageProvider, TextProvider, WordContent } from './types'

/**
 * Selects the text provider from the AI_PROVIDER environment variable.
 *
 * Server-only: reads API keys. Throws when the key for the selected provider
 * is missing, because a missing key is a deployment error that should surface
 * loudly at the first request rather than degrading into silent nulls that
 * look like model failures.
 */
export function getTextProvider(): TextProvider {
  if (config.ai.provider === 'qwen') {
    const key = process.env.OPENROUTER_API_KEY
    if (!key) throw new Error('OPENROUTER_API_KEY is not set but AI_PROVIDER=qwen')
    return new QwenTextProvider(key)
  }

  const key = process.env.GOOGLE_AI_API_KEY
  if (!key) throw new Error('GOOGLE_AI_API_KEY is not set')
  return new GeminiTextProvider(key)
}

/**
 * Comics always come from Gemini regardless of the text provider, because
 * Qwen handles multi-panel layout and cross-panel character consistency
 * less reliably.
 */
export function getImageProvider(): ImageProvider {
  const key = process.env.GOOGLE_AI_API_KEY
  if (!key) throw new Error('GOOGLE_AI_API_KEY is not set')
  return new GeminiImageProvider(key)
}
