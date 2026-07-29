import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchWordFromDictionaryApi } from '@/lib/dictionary-api'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('fetchWordFromDictionaryApi', () => {
  beforeEach(() => { mockFetch.mockReset() })

  it('returns null for a 404 response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 })
    const result = await fetchWordFromDictionaryApi('xyzabc123')
    expect(result).toBeNull()
  })

  it('parses definition, phonetic, audio, and synonyms', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ([{
        word: 'enormous',
        phonetics: [
          { text: '/ɪˈnɔːməs/', audio: 'https://api.example.com/enormous.mp3' }
        ],
        meanings: [{
          definitions: [{ definition: 'Very large in size or quantity.', synonyms: ['huge', 'vast'] }],
          synonyms: ['gigantic']
        }]
      }])
    })
    const result = await fetchWordFromDictionaryApi('enormous')
    expect(result).not.toBeNull()
    expect(result!.rawDefinition).toBe('Very large in size or quantity.')
    expect(result!.phonetic).toBe('/ɪˈnɔːməs/')
    expect(result!.synonyms).toContain('huge')
  })

  it('handles missing phonetic gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ([{
        word: 'test',
        phonetics: [],
        meanings: [{ definitions: [{ definition: 'A procedure.', synonyms: [] }], synonyms: [] }]
      }])
    })
    const result = await fetchWordFromDictionaryApi('test')
    expect(result!.phonetic).toBeNull()
  })

  it('returns the part of speech from the first meaning', async () => {
    // Drives the badge colour on every word card.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{
        word: 'enormous',
        phonetics: [{ text: '/ɪˈnɔːməs/' }],
        meanings: [{
          partOfSpeech: 'adjective',
          definitions: [{ definition: 'very large in size' }],
          synonyms: ['huge', 'massive'],
        }],
      }]),
    }) as unknown as typeof fetch

    const result = await fetchWordFromDictionaryApi('enormous')
    expect(result?.partOfSpeech).toBe('adjective')
  })

  it('returns a null part of speech when the entry has none', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{ word: 'x', meanings: [{ definitions: [{ definition: 'a thing' }] }] }]),
    }) as unknown as typeof fetch

    expect((await fetchWordFromDictionaryApi('x'))?.partOfSpeech).toBeNull()
  })

  it('returns null instead of throwing when the network call rejects', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error')) as unknown as typeof fetch
    await expect(fetchWordFromDictionaryApi('enormous')).resolves.toBeNull()
  })
})
