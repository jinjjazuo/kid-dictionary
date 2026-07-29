'use client'

import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

/**
 * The app-wide error boundary.
 *
 * Catches whatever the friendly, degrade-to-null paths in the data layer
 * cannot — an unexpected throw anywhere in a server or client component
 * during render. No error detail is shown: the audience is a child, and a
 * stack trace or message would only be confusing or scary. `reset()` is
 * Next.js's built-in retry, wired to the same Button every other primary
 * action in the app uses so the recovery path looks like part of the app.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="container mx-auto max-w-2xl px-4 py-12">
      <Card>
        <CardContent className="text-center">
          <h1 className="mb-2 font-fredoka text-3xl font-bold">Oops!</h1>
          <p className="mb-6 font-nunito text-lg text-muted-foreground">
            Something went wrong. Please try again!
          </p>
          <Button variant="playful" size="lg" onClick={reset}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
