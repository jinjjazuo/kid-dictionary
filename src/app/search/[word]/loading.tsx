import { Card, CardContent } from '@/components/ui/Card'

/** Staggers the three dots so they read as a wave rather than one blinking blob. */
const DOT_DELAYS = ['0s', '0.2s', '0.4s']

/**
 * Shown while the word page's server component awaits `lookupWord`.
 *
 * Next.js streams this the moment the navigation starts, so the screen
 * changes on click instead of freezing on the search box. Without it a cache
 * miss — two model calls plus image compression, around ten seconds — leaves
 * a child looking at an unchanged page with no evidence their word was heard,
 * and the usual response is to press "Look up" again.
 *
 * It cannot name the word being looked up: Next does not pass route params to
 * a loading boundary. The copy is deliberately generic for that reason.
 *
 * This file must stay a server component with no hooks or data access. A
 * loading boundary that suspends on anything of its own would defeat the point
 * by delaying the very feedback it exists to give.
 */
export default function Loading() {
  return (
    <main className="container mx-auto max-w-2xl px-4 py-16">
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <div role="status" className="flex flex-col items-center">
            <span className="mb-6 text-6xl animate-bounce-soft" aria-hidden="true">
              🎨
            </span>
            <h1 className="mb-2 font-fredoka text-3xl font-bold">Looking up your word!</h1>
            <p className="font-nunito text-lg text-muted-foreground">
              We&apos;re writing what it means and drawing your comic.
            </p>
          </div>

          <div className="mt-8 flex gap-2" aria-hidden="true">
            {DOT_DELAYS.map(delay => (
              <span
                key={delay}
                className="h-3 w-3 rounded-full bg-primary animate-bounce-soft"
                style={{ animationDelay: delay }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
