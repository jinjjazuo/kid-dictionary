'use client'

import { useEffect, useRef, useState } from 'react'
import { DictionaryEntry } from '@/components/DictionaryEntry'
import { ComicStrip } from '@/components/ComicStrip'
import { useWordStore } from '@/hooks/useWordStore'
import type { WordData } from '@/types'

/**
 * Renders a word and saves it to the collection automatically.
 *
 * Auto-save replaces the previous explicit button: a five-year-old should not
 * have to understand that looking a word up and keeping it are separate
 * actions.
 *
 * The save runs once per mount, guarded by a ref. Without the guard, adding to
 * the store triggers a re-read, which changes `words`, which would re-run the
 * effect — a loop.
 */
export function WordPageClient({ data }: { data: WordData }) {
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
      ageGroup: data.ageGroup,
      textVersion: data.textVersion,
      addedAt: new Date().toISOString(),
    }).then(() => setSaved(true))
  }, [loading, data, addWord])

  return (
    <>
      {saved && (
        <p className="mb-4 text-center font-nunito font-bold text-primary animate-pop">
          Saved to My Words
        </p>
      )}
      <DictionaryEntry data={data} />
      <ComicStrip word={data.word} imageUrl={data.comicImageUrl} scenes={data.storyScript} />
    </>
  )
}
