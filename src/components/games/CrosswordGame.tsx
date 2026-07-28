'use client'

import { useMemo, useState } from 'react'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — the package ships no type declarations
import clg from 'crossword-layout-generator'
import type { SavedWord } from '@/lib/store/types'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

type PlacedWord = {
  answer: string
  clue: string
  startx: number
  starty: number
  orientation: 'across' | 'down' | 'none'
  position: number
}

/**
 * A crossword built from the user's collection, laid out in the browser.
 *
 * The layout generator places what it can and marks the rest with
 * `orientation: 'none'`. Those are filtered out rather than treated as an
 * error — with a small or awkward set of words, some will not fit, and a
 * partial crossword is still playable.
 */
export function CrosswordGame({ words }: { words: SavedWord[] }) {
  const layout = useMemo(() => {
    const input = words.map(w => ({ clue: w.definition, answer: w.word }))
    const generated = clg.generateLayout(input)
    const placed: PlacedWord[] = (generated.result as PlacedWord[])
      .filter(w => w.orientation !== 'none')
    return { placed, rows: generated.rows as number, cols: generated.cols as number }
  }, [words])

  const [entries, setEntries] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)

  /** Cells that belong to a placed word, keyed "row,col". */
  const cells = useMemo(() => {
    const map = new Map<string, { answer: string; number?: number }>()
    for (const word of layout.placed) {
      for (let i = 0; i < word.answer.length; i++) {
        const row = word.starty - 1 + (word.orientation === 'down' ? i : 0)
        const col = word.startx - 1 + (word.orientation === 'across' ? i : 0)
        const key = `${row},${col}`
        map.set(key, {
          answer: word.answer[i].toUpperCase(),
          number: i === 0 ? word.position : map.get(key)?.number,
        })
      }
    }
    return map
  }, [layout])

  const allCorrect =
    cells.size > 0 &&
    Array.from(cells.entries()).every(([key, cell]) => entries[key]?.toUpperCase() === cell.answer)

  if (layout.placed.length === 0) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="text-center">
          <h2 className="mb-2 font-fredoka text-2xl font-bold">These words won&apos;t fit together</h2>
          <p className="font-nunito text-muted-foreground">
            Crosswords need words that share letters. Look up a few more and try again.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* The grid scrolls inside its own container so the page body never
          scrolls sideways on a phone. */}
      <div className="mb-6 overflow-x-auto">
        <div
          className="grid gap-0.5"
          style={{
            gridTemplateColumns: `repeat(${layout.cols}, minmax(2.25rem, 2.75rem))`,
            width: 'max-content',
          }}
        >
          {Array.from({ length: layout.rows * layout.cols }, (_, i) => {
            const row = Math.floor(i / layout.cols)
            const col = i % layout.cols
            const key = `${row},${col}`
            const cell = cells.get(key)

            if (!cell) return <div key={key} aria-hidden="true" />

            const value = entries[key] ?? ''
            const correct = checked && value.toUpperCase() === cell.answer
            const wrong = checked && value !== '' && !correct

            return (
              <div key={key} className="relative">
                {cell.number && (
                  <span className="absolute left-0.5 top-0 z-10 font-nunito text-[0.6rem] font-bold text-muted-foreground">
                    {cell.number}
                  </span>
                )}
                <input
                  type="text"
                  maxLength={1}
                  value={value}
                  aria-label={`Row ${row + 1}, column ${col + 1}`}
                  onChange={e =>
                    setEntries(prev => ({ ...prev, [key]: e.target.value.toUpperCase() }))
                  }
                  className={[
                    'aspect-square w-full rounded-sm border-2 text-center font-fredoka text-lg uppercase',
                    'focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40',
                    correct ? 'border-mint bg-mint/20'
                      : wrong ? 'border-coral bg-coral/20'
                      : 'border-border bg-card',
                  ].join(' ')}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="playful" onClick={() => setChecked(true)}>Check my answers</Button>
        <Button variant="outline" onClick={() => { setEntries({}); setChecked(false) }}>
          Start over
        </Button>
        {checked && allCorrect && (
          <p className="font-fredoka text-xl font-bold text-primary animate-pop">
            You solved it!
          </p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {(['across', 'down'] as const).map(direction => (
          <div key={direction}>
            <h2 className="mb-2 font-fredoka text-xl font-bold capitalize">{direction}</h2>
            <ol className="space-y-2">
              {layout.placed
                .filter(w => w.orientation === direction)
                .sort((a, b) => a.position - b.position)
                .map(word => (
                  <li key={`${direction}-${word.position}`} className="font-nunito">
                    <span className="font-bold">{word.position}.</span> {word.clue}
                  </li>
                ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  )
}
