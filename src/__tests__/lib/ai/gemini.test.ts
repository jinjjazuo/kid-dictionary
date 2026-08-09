import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGenerateContent = vi.fn()

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent }
    }
  },
}))

import { GeminiTextProvider } from '@/lib/ai/gemini'

function textResponse(text: string) {
  return { response: { text: () => text } }
}

describe('GeminiTextProvider.generateWordContent', () => {
  beforeEach(() => { mockGenerateContent.mockReset() })

  it('returns definition, examples and scenes from one call', async () => {
    mockGenerateContent.mockResolvedValue(
      textResponse(JSON.stringify({
        definition: 'Very, very big.',
        examples: ['The elephant is enormous.', 'My bag is enormous.'],
        scenes: [{ scene: 1, text: 'A.' }, { scene: 2, text: 'B.' }, { scene: 3, text: 'C.' }],
      }))
    )
    const result = await new GeminiTextProvider('key')
      .generateWordContent('enormous', 'very large', '4-6', 3)
    expect(result).toEqual({
      definition: 'Very, very big.',
      examples: ['The elephant is enormous.', 'My bag is enormous.'],
      scenes: [{ scene: 1, text: 'A.' }, { scene: 2, text: 'B.' }, { scene: 3, text: 'C.' }],
    })
    // The whole point of the combined call: one request, not two.
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
  })

  it('returns null on malformed JSON', async () => {
    mockGenerateContent.mockResolvedValue(textResponse('sorry, I cannot do that'))
    expect(await new GeminiTextProvider('key').generateWordContent('x', 'y', '4-6', 3)).toBeNull()
  })

  it('returns null when the API throws', async () => {
    mockGenerateContent.mockRejectedValue(new Error('rate limit'))
    expect(await new GeminiTextProvider('key').generateWordContent('x', 'y', '4-6', 3)).toBeNull()
  })

  it('keeps the text but nulls the scenes on a bad story', async () => {
    mockGenerateContent.mockResolvedValue(
      textResponse(JSON.stringify({
        definition: 'Very, very big.',
        examples: ['The elephant is enormous.'],
        scenes: [{ scene: 1, text: 'Only one.' }],
      }))
    )
    const result = await new GeminiTextProvider('key')
      .generateWordContent('enormous', 'very large', '4-6', 3)
    expect(result?.definition).toBe('Very, very big.')
    expect(result?.scenes).toBeNull()
  })

  it('asks for no scenes when the scene count is zero', async () => {
    mockGenerateContent.mockResolvedValue(
      textResponse('{"definition":"When a life ends.","examples":["The plant showed its death by drooping."]}')
    )
    const result = await new GeminiTextProvider('key')
      .generateWordContent('death', 'the end of life', '4-6', 0)
    expect(result?.scenes).toEqual([])
  })
})
