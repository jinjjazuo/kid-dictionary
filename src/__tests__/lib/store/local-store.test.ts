import { describe, it, expect } from 'vitest'
import { LocalWordStore } from '@/lib/store/local-store'
import type { SavedWord } from '@/lib/store/types'
import { config } from '@/config'

function makeWord(word: string, overrides: Partial<SavedWord> = {}): SavedWord {
  return {
    word,
    definition: `Definition of ${word}`,
    partOfSpeech: 'noun',
    examples: [`An example with ${word}.`],
    synonyms: [],
    phonetic: null,
    comicImageUrl: null,
    ageGroup: '4-6',
    textVersion: 1,
    addedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('LocalWordStore', () => {
  it('starts empty', async () => {
    const store = new LocalWordStore()
    expect(await store.list()).toEqual([])
  })

  it('adds a word and reads it back', async () => {
    const store = new LocalWordStore()
    await store.add(makeWord('dinosaur'))
    const words = await store.list()
    expect(words).toHaveLength(1)
    expect(words[0].word).toBe('dinosaur')
  })

  it('returns newest first', async () => {
    const store = new LocalWordStore()
    await store.add(makeWord('first'))
    await store.add(makeWord('second'))
    await store.add(makeWord('third'))
    expect((await store.list()).map(w => w.word)).toEqual(['third', 'second', 'first'])
  })

  it('upserts rather than duplicating', async () => {
    // Re-visiting a word page must not add it twice. add() is the only
    // write method, so it has to be idempotent on the word.
    const store = new LocalWordStore()
    await store.add(makeWord('dinosaur', { definition: 'Old text' }))
    await store.add(makeWord('dinosaur', { definition: 'New text' }))
    const words = await store.list()
    expect(words).toHaveLength(1)
    expect(words[0].definition).toBe('New text')
  })

  it('moves an upserted word to the front', async () => {
    const store = new LocalWordStore()
    await store.add(makeWord('first'))
    await store.add(makeWord('second'))
    await store.add(makeWord('first'))
    expect((await store.list()).map(w => w.word)).toEqual(['first', 'second'])
  })

  it('removes a word', async () => {
    const store = new LocalWordStore()
    await store.add(makeWord('dinosaur'))
    await store.add(makeWord('rainbow'))
    await store.remove('dinosaur')
    expect((await store.list()).map(w => w.word)).toEqual(['rainbow'])
  })

  it('ignores removal of a word it does not have', async () => {
    const store = new LocalWordStore()
    await store.add(makeWord('dinosaur'))
    await expect(store.remove('nothing')).resolves.toBeUndefined()
    expect(await store.list()).toHaveLength(1)
  })

  it('reports whether it holds a word', async () => {
    const store = new LocalWordStore()
    await store.add(makeWord('dinosaur'))
    expect(await store.has('dinosaur')).toBe(true)
    expect(await store.has('rainbow')).toBe(false)
  })

  it('matches words case-insensitively', async () => {
    // A child typing "Dinosaur" must not create a second entry.
    const store = new LocalWordStore()
    await store.add(makeWord('dinosaur'))
    expect(await store.has('DINOSAUR')).toBe(true)
    await store.remove('Dinosaur')
    expect(await store.list()).toHaveLength(0)
  })

  it('clears everything', async () => {
    const store = new LocalWordStore()
    await store.add(makeWord('dinosaur'))
    await store.add(makeWord('rainbow'))
    await store.clear()
    expect(await store.list()).toEqual([])
  })

  it('treats corrupt storage as empty rather than throwing', async () => {
    // A child must never see a blank screen because localStorage was
    // mangled by another tab, an extension, or a half-finished write.
    localStorage.setItem(config.storage.wordsKey, 'not valid json{{{')
    const store = new LocalWordStore()
    expect(await store.list()).toEqual([])
  })

  it('treats a non-array payload as empty', async () => {
    localStorage.setItem(config.storage.wordsKey, '{"not":"an array"}')
    const store = new LocalWordStore()
    expect(await store.list()).toEqual([])
  })

  it('recovers from corrupt storage on the next write', async () => {
    localStorage.setItem(config.storage.wordsKey, 'garbage')
    const store = new LocalWordStore()
    await store.add(makeWord('dinosaur'))
    expect((await store.list()).map(w => w.word)).toEqual(['dinosaur'])
  })
})
