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
    expect(result!.pronunciationUrl).toBe('https://api.example.com/enormous.mp3')
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
    expect(result!.pronunciationUrl).toBeNull()
  })
})
