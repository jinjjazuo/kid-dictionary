'use client'

import { useEffect, useRef, useState } from 'react'
import { useWordStore } from '@/hooks/useWordStore'
import type { WordData } from '@/types'

/**
 * Saves a looked-up word to the collection and confirms that it happened.
 *
 * Auto-save replaces the previous explicit button: a five-year-old should not
 * have to understand that looking a word up and keeping it are separate
 * actions.
 *
 * Rendered inside the comic's Suspense boundary, so it runs once with the
 * comic URL already resolved. Saving alongside the definition instead would
 * be faster but would store a null comicImageUrl, and the collection reads
 * only from localStorage — the word would show without its picture forever.
 *
 * The save runs once per mount, guarded by a ref. Without the guard, adding to
 * the store triggers a re-read, which changes `words`, which would re-run the
 * effect — a loop.
 */
export function SaveWord({ data }: { data: WordData }) {
  const { addWord, loading } = useWordStore()
  const [saved, setSaved] = useState(false)
  const hasSaved = useRef(false)

  useEffect(() => {
    if (loading || hasSaved.current) return
    hasSaved.current = true

    void addWord({
      word: data.word,
      definition: data.definition,
      partOfSpeech: data.partOfSpeech,
      examples: data.examples,
      synonyms: data.synonyms,
      phonetic: data.phonetic,
      comicImageUrl: data.comicImageUrl,
      audioUrl: data.audioUrl,
      ageGroup: data.ageGroup,
      textVersion: data.textVersion,
      addedAt: new Date().toISOString(),
    }).then(() => setSaved(true))
  }, [loading, data, addWord])

  if (!saved) return null

  return (
    <p className="mt-6 text-center font-nunito font-bold text-primary animate-pop">
      Saved to My Words
    </p>
  )
}
