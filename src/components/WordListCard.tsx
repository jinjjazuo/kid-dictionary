import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { SavedWord } from '@/lib/store/types'

export function WordListCard({
  entry,
  onRemove,
}: {
  entry: SavedWord
  onRemove: () => void
}) {
  return (
    <Card className="transition-all hover:border-primary/40">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <Link
                href={`/search/${encodeURIComponent(entry.word)}`}
                className="truncate font-fredoka text-xl font-bold capitalize hover:text-primary"
              >
                {entry.word}
              </Link>
              <Badge partOfSpeech={entry.partOfSpeech} />
            </div>
            <p className="line-clamp-2 font-nunito text-sm text-muted-foreground">
              {entry.definition}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={`Remove ${entry.word}`}
            title="Remove — you'll need to answer a question first"
            className="shrink-0 text-coral hover:bg-coral/10"
          >
            ✕
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
