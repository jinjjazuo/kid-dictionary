'use client'

import Link from 'next/link'
import { SearchBar } from '@/components/SearchBar'
import { useWordStore } from '@/hooks/useWordStore'
import { useAgeGroup } from '@/hooks/useAgeGroup'

/** Words that reliably produce a good comic — a starting point for a child who cannot think of one. */
const SUGGESTIONS = ['dinosaur', 'rainbow', 'adventure', 'curious']

/**
 * A client component because the stats strip reads the collection. The hero
 * and search bar render identically on server and client, so only the strip
 * waits on `loading`.
 */
export default function HomePage() {
  const { words, loading } = useWordStore()
  const { ageGroup } = useAgeGroup()

  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute left-10 top-10 h-16 w-16 rounded-full bg-sunshine/30 animate-float" />
          <div className="absolute right-20 top-32 h-12 w-12 rounded-full bg-coral/30 animate-bounce-soft" />
          <div className="absolute bottom-10 left-1/4 h-20 w-20 rounded-full bg-lavender/30 animate-float"
               style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-20 right-1/3 h-10 w-10 rounded-full bg-mint/30 animate-bounce-soft"
               style={{ animationDelay: '0.5s' }} />
        </div>

        <div className="container relative mx-auto px-4 py-12 md:py-20">
          <div className="mb-10 text-center">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-sunshine/20 px-4 py-2
                          font-nunito font-bold text-sunshine-foreground">
              Every word you look up is saved for you
            </p>
            <h1 className="mb-4 font-fredoka text-4xl font-bold md:text-6xl">
              Discover the <span className="text-gradient">Magic of Words</span>
            </h1>
            <p className="mx-auto max-w-2xl font-nunito text-xl text-muted-foreground">
              Type any word to find out what it means and see it come to life in a comic.
            </p>
          </div>

          <SearchBar />

          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <span className="font-nunito text-muted-foreground">Try searching:</span>
            {SUGGESTIONS.map(word => (
              <Link
                key={word}
                href={`/search/${word}?ageGroup=${ageGroup}`}
                className="rounded-full border-2 border-border bg-card px-4 py-2 font-nunito
                           font-bold transition-all hover:border-primary hover:bg-primary/5"
              >
                {word}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {!loading && words.length > 0 && (
        <section className="border-t-2 border-border bg-card/50">
          <div className="container mx-auto flex flex-wrap items-center justify-center gap-8 px-4 py-8">
            <div>
              <p className="font-fredoka text-3xl font-bold text-primary">{words.length}</p>
              <p className="font-nunito text-sm text-muted-foreground">
                {words.length === 1 ? 'word learned' : 'words learned'}
              </p>
            </div>
            <Link href="/dictionary" className="font-nunito font-bold text-primary hover:underline">
              See my words →
            </Link>
          </div>
        </section>
      )}
    </main>
  )
}
