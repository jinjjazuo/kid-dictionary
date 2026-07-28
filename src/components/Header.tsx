'use client'

import Link from 'next/link'
import { config, type AgeGroup } from '@/config'
import { useAgeGroup } from '@/hooks/useAgeGroup'

const OPTIONS: { label: string; value: AgeGroup }[] = [
  { label: 'Ages 4–6', value: config.ageGroups.young.label },
  { label: 'Ages 7–10', value: config.ageGroups.older.label },
]

/**
 * Persistent navigation and the reading-level toggle.
 *
 * A client component because the toggle reads localStorage. It renders the
 * default age group during the first paint and corrects itself once the
 * stored value loads — the toggle is a preference, not content, so a brief
 * default selection is harmless where a flash of wrong word content would
 * not be.
 */
export function Header() {
  const { ageGroup, setAgeGroup } = useAgeGroup()

  return (
    <header className="border-b-2 border-border bg-card/80 backdrop-blur">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-fredoka text-2xl font-bold text-gradient">
          Word World
        </Link>

        <nav className="flex items-center gap-1 font-nunito font-bold">
          <Link href="/dictionary" className="rounded-lg px-3 py-2 hover:bg-muted">
            My Words
          </Link>
          <Link href="/games/quiz" className="rounded-lg px-3 py-2 hover:bg-muted">
            Quiz
          </Link>
          <Link href="/games/crossword" className="rounded-lg px-3 py-2 hover:bg-muted">
            Crossword
          </Link>
        </nav>

        <div
          className="flex items-center gap-1 rounded-lg bg-muted p-1"
          role="radiogroup"
          aria-label="Reading level"
        >
          {OPTIONS.map(option => (
            <button
              key={option.value}
              role="radio"
              aria-checked={ageGroup === option.value}
              onClick={() => setAgeGroup(option.value)}
              className={[
                'rounded-md px-3 py-2 text-sm font-nunito font-bold transition-colors',
                ageGroup === option.value
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
