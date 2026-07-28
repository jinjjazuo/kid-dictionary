import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWordStore } from '@/hooks/useWordStore'
import type { SavedWord } from '@/lib/store/types'

function makeWord(word: string): SavedWord {
  return {
    word,
    definition: `Definition of ${word}`,
    partOfSpeech: 'noun',
    examples: [],
    synonyms: [],
    phonetic: null,
    comicImageUrl: null,
    ageGroup: '4-6',
    textVersion: 1,
    addedAt: new Date().toISOString(),
  }
}

describe('useWordStore', () => {
  it('starts loading, then settles empty', async () => {
    const { result } = renderHook(() => useWordStore())
    // loading must start true: rendering an empty collection before the
    // first read resolves would flash "no words yet" at a child who has some.
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.words).toEqual([])
  })

  it('adds a word and re-reads', async () => {
    const { result } = renderHook(() => useWordStore())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.addWord(makeWord('dinosaur')) })
    expect(result.current.words.map(w => w.word)).toEqual(['dinosaur'])
  })

  it('removes a word', async () => {
    const { result } = renderHook(() => useWordStore())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.addWord(makeWord('dinosaur')) })
    await act(async () => { await result.current.removeWord('dinosaur') })
    expect(result.current.words).toEqual([])
  })

  it('clears everything', async () => {
    const { result } = renderHook(() => useWordStore())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.addWord(makeWord('a')) })
    await act(async () => { await result.current.addWord(makeWord('b')) })
    await act(async () => { await result.current.clearAll() })
    expect(result.current.words).toEqual([])
  })

  it('reports membership synchronously from loaded state', async () => {
    // Synchronous so a render can ask "is this saved?" without an effect.
    const { result } = renderHook(() => useWordStore())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.addWord(makeWord('dinosaur')) })
    expect(result.current.hasWord('DINOSAUR')).toBe(true)
    expect(result.current.hasWord('rainbow')).toBe(false)
  })
})
