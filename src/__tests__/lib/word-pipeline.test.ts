import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockSingle,
  mockInsertSingle,
  mockFetchDict,
  mockEnrich,
  mockStory,
  mockComic,
  mockPut,
} = vi.hoisted(() => ({
  mockSingle: vi.fn(),
  mockInsertSingle: vi.fn(),
  mockFetchDict: vi.fn(),
  mockEnrich: vi.fn(),
  mockStory: vi.fn(),
  mockComic: vi.fn(),
  mockPut: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mockSingle }) }) }),
      }),
      insert: () => ({ select: () => ({ single: mockInsertSingle }) }),
    }),
  }),
}))
vi.mock('@/lib/dictionary-api', () => ({ fetchWordFromDictionaryApi: mockFetchDict }))
vi.mock('@/lib/ai', () => ({
  getTextProvider: () => ({ enrichWord: mockEnrich, generateStory: mockStory }),
  getImageProvider: () => ({ generateComic: mockComic }),
}))
vi.mock('@/lib/storage', () => ({ getImageStore: () => ({ put: mockPut }) }))
vi.mock('@/lib/images/compress', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  compressToWebp: async (b: Buffer) => b,
}))

import { lookupWord } from '@/lib/word-pipeline'

const DICT = {
  phonetic: '/test/',
  partOfSpeech: 'noun',
  rawDefinition: 'a raw definition',
  synonyms: ['other'],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: null })
  mockFetchDict.mockResolvedValue(DICT)
  mockEnrich.mockResolvedValue({ definition: 'Simple.', examples: ['An example.'] })
  mockStory.mockResolvedValue([
    { scene: 1, text: 'One.' }, { scene: 2, text: 'Two.' }, { scene: 3, text: 'Three.' },
  ])
  mockComic.mockResolvedValue(Buffer.from('fake-png'))
  mockPut.mockResolvedValue('https://cdn.example/comic.webp')
  mockInsertSingle.mockImplementation(async () => ({
    data: {
      id: 'row-1', word: 'dinosaur', age_group: '4-6', definition: 'Simple.',
      part_of_speech: 'noun', examples: ['An example.'], synonyms: ['other'],
      phonetic: '/test/', story_script: [], comic_image_url: 'https://cdn.example/comic.webp',
      text_version: 1, image_version: 1,
    },
  }))
})

describe('lookupWord — cache', () => {
  it('returns a cached row without calling anything else', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: 'cached-1', word: 'dinosaur', age_group: '4-6', definition: 'Cached.',
        part_of_speech: 'noun', examples: [], synonyms: [], phonetic: null,
        story_script: [], comic_image_url: null, text_version: 1, image_version: 1,
      },
    })

    const result = await lookupWord('dinosaur', '4-6')

    expect(result.found).toBe(true)
    if (result.found) expect(result.data.definition).toBe('Cached.')
    // The cache is the entire cost control. Any call past it on a hit is a bug.
    expect(mockFetchDict).not.toHaveBeenCalled()
    expect(mockEnrich).not.toHaveBeenCalled()
    expect(mockComic).not.toHaveBeenCalled()
  })
})

describe('lookupWord — safety', () => {
  it('refuses a blocked word before spending anything', async () => {
    const result = await lookupWord('porn', '4-6')
    expect(result.found).toBe(false)
    expect(mockFetchDict).not.toHaveBeenCalled()
    expect(mockEnrich).not.toHaveBeenCalled()
  })

  it('explains a sensitive word but generates no comic', async () => {
    // The definition is the useful part. Only the illustration is withheld.
    await lookupWord('death', '4-6')
    expect(mockEnrich).toHaveBeenCalled()
    expect(mockStory).not.toHaveBeenCalled()
    expect(mockComic).not.toHaveBeenCalled()
  })
})

describe('lookupWord — validation', () => {
  it('stops before any AI call when the word is not real', async () => {
    // This is what stops gibberish consuming the daily quota.
    mockFetchDict.mockResolvedValue(null)
    const result = await lookupWord('asdfgh', '4-6')
    expect(result.found).toBe(false)
    expect(mockEnrich).not.toHaveBeenCalled()
  })

  it('stops before any AI call when the dictionary entry has no definition', async () => {
    // An entry can exist with phonetics/synonyms but an empty definition
    // string, which would otherwise render a blank word page.
    mockFetchDict.mockResolvedValue({ ...DICT, rawDefinition: '' })
    const result = await lookupWord('asdfgh', '4-6')
    expect(result.found).toBe(false)
    expect(mockEnrich).not.toHaveBeenCalled()
  })
})

describe('lookupWord — degradation', () => {
  it('falls back to the raw definition and does not cache when enrichment fails', async () => {
    mockEnrich.mockResolvedValue(null)
    const result = await lookupWord('dinosaur', '4-6')

    expect(result.found).toBe(true)
    if (result.found) {
      expect(result.data.definition).toBe('a raw definition')
      expect(result.data.id).toBeNull()
    }
    // Not cached: a retry next time may succeed, and a row with unimproved
    // text would be served forever.
    expect(mockInsertSingle).not.toHaveBeenCalled()
  })

  it('keeps the definition and does not cache when the story fails', async () => {
    mockStory.mockResolvedValue(null)
    const result = await lookupWord('dinosaur', '4-6')

    expect(result.found).toBe(true)
    if (result.found) expect(result.data.definition).toBe('Simple.')
    expect(mockComic).not.toHaveBeenCalled()
    expect(mockInsertSingle).not.toHaveBeenCalled()
  })

  it('caches with a null image when image generation fails', async () => {
    // Image failure DOES cache, unlike text failure: the text is worth
    // keeping and image generation is the flaky, rate-limited step.
    mockComic.mockResolvedValue(null)
    await lookupWord('dinosaur', '4-6')
    expect(mockInsertSingle).toHaveBeenCalled()
  })

  it('caches with a null image when the upload fails', async () => {
    mockPut.mockResolvedValue(null)
    await lookupWord('dinosaur', '4-6')
    expect(mockInsertSingle).toHaveBeenCalled()
  })
})

describe('lookupWord — success', () => {
  it('generates, uploads and caches', async () => {
    const result = await lookupWord('dinosaur', '4-6')
    expect(result.found).toBe(true)
    if (result.found) {
      expect(result.data.comicImageUrl).toBe('https://cdn.example/comic.webp')
      expect(result.data.id).toBe('row-1')
    }
    expect(mockPut).toHaveBeenCalled()
  })

  it('asks for the scene count matching the age group', async () => {
    await lookupWord('dinosaur', '7-10')
    expect(mockStory).toHaveBeenCalledWith('dinosaur', '7-10', 5)
  })

  it('normalises the word before doing anything', async () => {
    await lookupWord('  DINOSAUR  ', '4-6')
    expect(mockFetchDict).toHaveBeenCalledWith('dinosaur')
  })
})
