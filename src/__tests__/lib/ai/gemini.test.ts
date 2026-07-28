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

describe('GeminiTextProvider.enrichWord', () => {
  beforeEach(() => { mockGenerateContent.mockReset() })

  it('returns the parsed enrichment', async () => {
    mockGenerateContent.mockResolvedValue(
      textResponse('{"definition":"Very, very big.","examples":["The elephant is enormous.","My bag is enormous."]}')
    )
    const result = await new GeminiTextProvider('key').enrichWord('enormous', 'very large', '4-6')
    expect(result).toEqual({
      definition: 'Very, very big.',
      examples: ['The elephant is enormous.', 'My bag is enormous.'],
    })
  })

  it('drops examples that never use the word', async () => {
    // Observed failure: asked for "enormous", the model paraphrased it away
    // and returned sentences about being "big". Such a sentence does not show
    // the child how to use the word, so it must not reach the page.
    mockGenerateContent.mockResolvedValue(
      textResponse('{"definition":"Very, very big.","examples":["The dog is so big and tall.","The elephant is enormous."]}')
    )
    const result = await new GeminiTextProvider('key').enrichWord('enormous', 'very large', '4-6')
    expect(result?.examples).toEqual(['The elephant is enormous.'])
  })

  it('returns null on malformed JSON', async () => {
    mockGenerateContent.mockResolvedValue(textResponse('sorry, I cannot do that'))
    expect(await new GeminiTextProvider('key').enrichWord('x', 'y', '4-6')).toBeNull()
  })

  it('returns null when the response is missing a definition', async () => {
    // Parseable but useless. A row with no definition has no value, so the
    // pipeline must treat this as failure rather than cache it.
    mockGenerateContent.mockResolvedValue(textResponse('{"examples":["a"]}'))
    expect(await new GeminiTextProvider('key').enrichWord('x', 'y', '4-6')).toBeNull()
  })

  it('returns null when the API throws', async () => {
    mockGenerateContent.mockRejectedValue(new Error('rate limit'))
    expect(await new GeminiTextProvider('key').enrichWord('x', 'y', '4-6')).toBeNull()
  })
})

describe('GeminiTextProvider.generateStory', () => {
  beforeEach(() => { mockGenerateContent.mockReset() })

  it('returns the parsed scenes', async () => {
    mockGenerateContent.mockResolvedValue(
      textResponse('[{"scene":1,"text":"A."},{"scene":2,"text":"B."},{"scene":3,"text":"C."}]')
    )
    const scenes = await new GeminiTextProvider('key').generateStory('big', '4-6', 3)
    expect(scenes).toHaveLength(3)
    expect(scenes?.[0]).toEqual({ scene: 1, text: 'A.' })
  })

  it('returns null when the model returns the wrong number of scenes', async () => {
    // Panel highlight positioning assumes the script length matches the
    // requested count, so a mismatch is a failure rather than something to
    // silently accept.
    mockGenerateContent.mockResolvedValue(textResponse('[{"scene":1,"text":"Only one."}]'))
    expect(await new GeminiTextProvider('key').generateStory('big', '4-6', 3)).toBeNull()
  })

  it('returns null when the payload is not an array', async () => {
    mockGenerateContent.mockResolvedValue(textResponse('{"scene":1,"text":"A."}'))
    expect(await new GeminiTextProvider('key').generateStory('big', '4-6', 3)).toBeNull()
  })
})
