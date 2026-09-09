import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchWordFromDictionaryApi } from '@/lib/dictionary-api'
import { config } from '@/config'

const mockFetch = vi.fn()
global.fetch = mockFetch

/** One kaikki JSONL line: a single part of speech for a word. */
function posLine(over: Record<string, unknown> = {}) {
  return JSON.stringify({
    word: 'rainbow',
    pos: 'noun',
    sounds: [
      { ipa: '/ˈɹeɪnboʊ/', tags: ['General-American'] },
      { enpr: "rān'bō" },
      { audio: 'En-us-rainbow.ogg', ogg_url: 'https://x/a.ogg', mp3_url: 'https://x/a.mp3' },
    ],
    senses: [{ glosses: ['A multicoloured arch in the sky.'], synonyms: [{ word: 'iris' }] }],
    synonyms: [{ word: 'spectrum' }],
    ...over,
  })
}

const ok = (body: string) => ({ ok: true, status: 200, text: async () => body })

beforeEach(() => { mockFetch.mockReset() })

describe('fetchWordFromDictionaryApi', () => {
  it('shards the url by first letter and first two letters', async () => {
    mockFetch.mockResolvedValue(ok(posLine()))
    await fetchWordFromDictionaryApi('rainbow')

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe(`${config.dictionary.baseUrl}/r/ra/rainbow.jsonl`)
    // Wikimedia 403s an audio request with no User-Agent; send one everywhere.
    expect(init.headers['User-Agent']).toBe(config.dictionary.userAgent)
  })

  it('pulls the gloss, ipa, synonyms and mp3 out of a line', async () => {
    mockFetch.mockResolvedValue(ok(posLine()))
    const result = await fetchWordFromDictionaryApi('rainbow')

    expect(result).not.toBeNull()
    expect(result!.rawDefinition).toBe('A multicoloured arch in the sky.')
    expect(result!.partOfSpeech).toBe('noun')
    expect(result!.phonetic).toBe('/ˈɹeɪnboʊ/')
    expect(result!.audioUrl).toBe('https://x/a.mp3')
    expect(result!.synonyms).toContain('iris')
  })

  it('skips senses Wiktionary marks obsolete', async () => {
    // Wiktionary orders senses historically, so 'enormous' opens with a sense
    // no child will ever meet. Taking senses[0] would define it as "unusual".
    mockFetch.mockResolvedValue(ok(posLine({
      senses: [
        { glosses: ['Deviating from the norm; unusual.'], tags: ['obsolete'] },
        { glosses: ['Extremely large.'] },
      ],
    })))
    const result = await fetchWordFromDictionaryApi('enormous')
    expect(result!.rawDefinition).toBe('Extremely large.')
  })

  it('falls back to a filtered sense rather than calling the word unknown', async () => {
    // Some words have nothing but tagged senses. A definition a child can read
    // beats "we don't know that word".
    mockFetch.mockResolvedValue(ok(posLine({
      senses: [{ glosses: ['Only sense, and it is dated.'], tags: ['dated'] }],
    })))
    const result = await fetchWordFromDictionaryApi('whatsit')
    expect(result!.rawDefinition).toBe('Only sense, and it is dated.')
  })

  it('prefers the first part of speech that has a usable sense', async () => {
    const unusable = posLine({ pos: 'verb', senses: [{ glosses: [] }] })
    mockFetch.mockResolvedValue(ok(`${unusable}\n${posLine({ pos: 'noun' })}`))

    const result = await fetchWordFromDictionaryApi('rainbow')
    expect(result!.partOfSpeech).toBe('noun')
  })

  it('expands the abbreviated part of speech', async () => {
    // kaikki says "adj"; the badge colours on "adjective" and shows the label
    // to the child, so an abbreviation would render grey and read wrong.
    mockFetch.mockResolvedValue(ok(posLine({ pos: 'adj' })))
    const result = await fetchWordFromDictionaryApi('enormous')
    expect(result!.partOfSpeech).toBe('adjective')
  })

  it('passes through a part of speech it has no expansion for', async () => {
    mockFetch.mockResolvedValue(ok(posLine({ pos: 'phrase' })))
    const result = await fetchWordFromDictionaryApi('rainbow')
    expect(result!.partOfSpeech).toBe('phrase')
  })

  it('caps synonyms at the configured maximum', async () => {
    mockFetch.mockResolvedValue(ok(posLine({
      synonyms: Array.from({ length: 20 }, (_, i) => ({ word: `syn${i}` })),
    })))
    const result = await fetchWordFromDictionaryApi('rainbow')
    expect(result!.synonyms.length).toBeLessThanOrEqual(config.word.maxSynonyms)
  })

  it('returns a null phonetic and audio when the word has no recording', async () => {
    mockFetch.mockResolvedValue(ok(posLine({ sounds: [] })))
    const result = await fetchWordFromDictionaryApi('rainbow')
    expect(result!.phonetic).toBeNull()
    expect(result!.audioUrl).toBeNull()
    expect(result!.rawDefinition).toBe('A multicoloured arch in the sky.')
  })

  it('returns null for an unknown word', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, text: async () => '' })
    expect(await fetchWordFromDictionaryApi('xyzabc123')).toBeNull()
  })

  it('returns null when the upstream is unreachable', async () => {
    // An outage must degrade to "not found", never crash the word page.
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))
    expect(await fetchWordFromDictionaryApi('rainbow')).toBeNull()
  })

  it('returns null when the payload is not the shape we expect', async () => {
    mockFetch.mockResolvedValue(ok('not json at all'))
    expect(await fetchWordFromDictionaryApi('rainbow')).toBeNull()
  })
})
