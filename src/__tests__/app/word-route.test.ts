import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockLookup } = vi.hoisted(() => ({ mockLookup: vi.fn() }))
vi.mock('@/lib/word-pipeline', () => ({ lookupWord: mockLookup }))

import { GET } from '@/app/api/word/[word]/route'

const DATA = {
  id: null,
  word: 'dinosaur',
  ageGroup: '4-6' as const,
  definition: 'Simple.',
  partOfSpeech: 'noun',
  examples: [],
  synonyms: [],
  phonetic: null,
  storyScript: [{ scene: 1, text: 'One.' }],
  comicImageUrl: null,
  textVersion: 1,
}

beforeEach(() => vi.clearAllMocks())

/**
 * The route is plain JSON with no streaming, so it cannot hand a pending
 * comic to its caller the way the page can. It has to wait for the promise
 * and fold the URL in, or every cache-miss response would claim the word has
 * no comic.
 */
describe('GET /api/word/[word]', () => {
  it('waits for the deferred comic and returns its url', async () => {
    mockLookup.mockResolvedValue({
      found: true,
      data: DATA,
      comic: Promise.resolve('https://cdn.example/comic.webp'),
    })

    const res = await GET(new Request('http://x/api/word/dinosaur'), {
      params: { word: 'dinosaur' },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      comicImageUrl: 'https://cdn.example/comic.webp',
    })
  })

  it('returns a null comic url when the comic failed', async () => {
    mockLookup.mockResolvedValue({ found: true, data: DATA, comic: Promise.resolve(null) })

    const res = await GET(new Request('http://x/api/word/dinosaur'), {
      params: { word: 'dinosaur' },
    })

    await expect(res.json()).resolves.toMatchObject({ comicImageUrl: null })
  })

  it('404s an unknown word', async () => {
    mockLookup.mockResolvedValue({ found: false })

    const res = await GET(new Request('http://x/api/word/asdfgh'), {
      params: { word: 'asdfgh' },
    })

    expect(res.status).toBe(404)
  })
})
