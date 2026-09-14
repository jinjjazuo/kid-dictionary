import { Card, CardContent } from '@/components/ui/Card'

/**
 * Instant feedback for the search segment.
 *
 * The App Router only reveals a pending navigation when the segment has a
 * loading boundary. Without this file the router holds the previous page on
 * screen for the whole server render — dictionary API, then the text model,
 * then the comic model — so a tap on "Look up" looks like it did nothing and
 * children tap it again.
 *
 * The skeleton mirrors DictionaryEntry and ComicStrip so the real content
 * does not shift the layout when it replaces this.
 */
export default function Loading() {
  return (
    <main className="container mx-auto max-w-2xl px-4 py-8 lg:max-w-5xl">
      <div role="status" aria-label="Looking up your word">
        <p className="mb-6 flex items-center justify-center gap-2 text-center font-fredoka
                      text-2xl font-bold text-primary">
          Looking up your word
          {/* Staggered so the three dots read as a wave rather than a blink. */}
          {[0, 0.2, 0.4].map(delay => (
            <span
              key={delay}
              className="h-2.5 w-2.5 rounded-full bg-primary animate-bounce-soft"
              style={{ animationDelay: `${delay}s`, animationDuration: '1s' }}
            />
          ))}
        </p>

        <Card>
          <CardContent className="animate-pulse">
            <div className="mb-3 h-11 w-2/5 rounded-lg bg-muted" />
            <div className="mb-6 h-5 w-1/4 rounded bg-muted" />
            <div className="mb-2 h-6 w-full rounded bg-muted" />
            <div className="h-6 w-4/5 rounded bg-muted" />
          </CardContent>
        </Card>

        {/* Same columns as ComicStrip, so the picture lands where this was. */}
        <div className="mt-8 lg:grid lg:grid-cols-[3fr_2fr] lg:gap-8">
          <div className="aspect-[3/2] w-full animate-pulse rounded-2xl border-2
                          border-border bg-muted" />
        </div>
      </div>
    </main>
  )
}
