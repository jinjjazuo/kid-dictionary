'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getWordStore } from '@/lib/store'
import type { SavedWord } from '@/lib/store/types'

/**
 * React binding for the user's word collection.
 *
 * `loading` starts true and every consumer must respect it. localStorage does
 * not exist during server rendering, so the first read can only happen in an
 * effect — rendering the empty state before it resolves would flash "no words
 * yet" at a child whose collection is full, and rendering collection content
 * on the server would produce a hydration mismatch.
 *
 * Every mutation re-reads the store rather than patching local state, so the
 * hook cannot drift from what is actually persisted.
 */
export function useWordStore() {
  const store = useMemo(getWordStore, [])
  const [words, setWords] = useState<SavedWord[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setWords(await store.list())
    setLoading(false)
  }, [store])

  useEffect(() => { void refresh() }, [refresh])

  const addWord = useCallback(async (word: SavedWord) => {
    await store.add(word)
    await refresh()
  }, [store, refresh])

  const removeWord = useCallback(async (word: string) => {
    await store.remove(word)
    await refresh()
  }, [store, refresh])

  const clearAll = useCallback(async () => {
    await store.clear()
    await refresh()
  }, [store, refresh])

  /** Synchronous, so a render can ask without an effect. */
  const hasWord = useCallback(
    (word: string) => words.some(w => w.word.toLowerCase() === word.toLowerCase()),
    [words],
  )

  return { words, loading, addWord, removeWord, clearAll, hasWord }
}
