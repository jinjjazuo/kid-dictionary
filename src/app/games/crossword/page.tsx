'use client'

import { config } from '@/config'
import { useWordStore } from '@/hooks/useWordStore'
import { CrosswordGame } from '@/components/games/CrosswordGame'
import { NotEnoughWords } from '@/components/games/NotEnoughWords'

/** Client-only: the layout is generated in the browser from localStorage. */
export default function CrosswordPage() {
  const { words, loading } = useWordStore()

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-center font-fredoka text-3xl font-bold md:text-4xl">
        Word Crossword
      </h1>

      {loading ? (
        <p className="text-center font-nunito text-muted-foreground">Loading your words...</p>
      ) : words.length < config.games.minWordsRequired ? (
        <NotEnoughWords have={words.length} />
      ) : (
        <CrosswordGame words={words} />
      )}
    </main>
  )
}
