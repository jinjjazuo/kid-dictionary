'use client'

import Link from 'next/link'
import { useState } from 'react'
import { config } from '@/config'
import { useWordStore } from '@/hooks/useWordStore'
import { WordListCard } from '@/components/WordListCard'
import { RemoveWordQuiz } from '@/components/RemoveWordQuiz'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import type { SavedWord } from '@/lib/store/types'

/**
 * The user's collection.
 *
 * A client component throughout: the collection lives in localStorage, which
 * does not exist during server rendering. The loading state is not optional —
 * rendering the empty state first would tell a child their words are gone.
 */
export default function DictionaryPage() {
  const { words, loading, removeWord } = useWordStore()
  const [sortAlphabetically, setSortAlphabetically] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<SavedWord | null>(null)

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-12 text-center">
        <p className="font-nunito text-muted-foreground">Loading your words...</p>
      </main>
    )
  }

  if (pendingRemoval) {
    return (
      <main className="container mx-auto max-w-lg px-4 py-8">
        <RemoveWordQuiz
          word={pendingRemoval}
          allWords={words}
          onCorrect={async () => {
            await removeWord(pendingRemoval.word)
            setPendingRemoval(null)
          }}
          onCancel={() => setPendingRemoval(null)}
        />
      </main>
    )
  }

  const displayed = sortAlphabetically
    ? [...words].sort((a, b) => a.word.localeCompare(b.word))
    : words

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="mb-2 font-fredoka text-3xl font-bold md:text-4xl">My Words</h1>
        <p className="font-nunito text-muted-foreground">
          {words.length === 0
            ? 'Look up a word and it will appear here.'
            : `You have learned ${words.length} ${words.length === 1 ? 'word' : 'words'}.`}
        </p>
      </div>

      {words.length === 0 ? (
        <Card className="mx-auto max-w-md">
          <CardContent className="text-center">
            <h2 className="mb-2 font-fredoka text-xl font-bold">No words yet</h2>
            <p className="mb-6 font-nunito text-muted-foreground">
              Every word you look up is saved here automatically.
            </p>
            <Link href="/">
              <Button variant="playful">Start looking up words</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Button
              variant={sortAlphabetically ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortAlphabetically(!sortAlphabetically)}
            >
              {sortAlphabetically ? 'A–Z' : 'Newest first'}
            </Button>

            {words.length >= config.games.minWordsRequired && (
              <div className="flex gap-2">
                <Link href="/games/quiz"><Button variant="playful" size="sm">Play quiz</Button></Link>
                <Link href="/games/crossword"><Button variant="outline" size="sm">Crossword</Button></Link>
              </div>
            )}
          </div>

          {words.length < config.games.minWordsRequired && (
            <p className="mb-6 rounded-xl border-2 border-sunshine/30 bg-sunshine/20 p-4
                          text-center font-nunito text-sunshine-foreground">
              Learn {config.games.minWordsRequired - words.length} more{' '}
              {config.games.minWordsRequired - words.length === 1 ? 'word' : 'words'} to unlock the games!
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {displayed.map(entry => (
              <WordListCard
                key={entry.word}
                entry={entry}
                onRemove={() => setPendingRemoval(entry)}
              />
            ))}
          </div>
        </>
      )}
    </main>
  )
}
