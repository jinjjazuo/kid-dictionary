'use client'

import { config } from '@/config'
import { useWordStore } from '@/hooks/useWordStore'
import { QuizGame } from '@/components/games/QuizGame'
import { NotEnoughWords } from '@/components/games/NotEnoughWords'

/**
 * Client-only: the quiz reads the collection from localStorage and needs no
 * server involvement at all.
 */
export default function QuizPage() {
  const { words, loading } = useWordStore()

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-center font-fredoka text-3xl font-bold md:text-4xl">
        Word Quiz
      </h1>

      {loading ? (
        <p className="text-center font-nunito text-muted-foreground">Loading your words...</p>
      ) : words.length < config.games.minWordsRequired ? (
        <NotEnoughWords have={words.length} />
      ) : (
        <QuizGame words={words} />
      )}
    </main>
  )
}
