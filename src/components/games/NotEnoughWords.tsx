import Link from 'next/link'
import { config } from '@/config'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

/**
 * Shown when the collection is too small to build a game.
 *
 * Framed as progress towards unlocking rather than as a refusal — the child
 * is told how many more words they need and given the way to get them.
 */
export function NotEnoughWords({ have }: { have: number }) {
  const needed = config.games.minWordsRequired - have

  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="text-center">
        <h2 className="mb-2 font-fredoka text-2xl font-bold">Almost ready!</h2>
        <p className="mb-6 font-nunito text-lg text-muted-foreground">
          Look up {needed} more {needed === 1 ? 'word' : 'words'} to start playing.
          You have {have} so far.
        </p>
        <Link href="/">
          <Button variant="playful">Look up a word</Button>
        </Link>
      </CardContent>
    </Card>
  )
}
