'use client'

import { useEffect, useRef } from 'react'
import { ageGroupForAge, pickableAges } from '@/config'
import { useAgeGroup } from '@/hooks/useAgeGroup'

const AGES = pickableAges()

/**
 * First-launch reading level prompt, asked as "How old are you?".
 *
 * The question a child is used to answering is their age, not which of two
 * ranges they read at — so the screen offers every age the app is built for
 * and `ageGroupForAge` does the mapping. That keeps the bands an internal
 * detail: widening one changes the buttons here without touching this file.
 *
 * Choosing is the only way out. There is no skip link: every age maps to a
 * valid level and one of them is already the default, so a skip would add a
 * control a four-year-old can mis-tap without changing any outcome.
 *
 * It writes through `useAgeGroup`, so the header toggle updates in the same
 * tick and the two can never disagree about what was picked.
 *
 * @param onChosen Runs after the level is stored, to hand over to the tour
 */
export function AgePicker({ onChosen }: { onChosen: () => void }) {
  const { setAgeGroup } = useAgeGroup()
  const firstAge = useRef<HTMLButtonElement>(null)

  // Moves the keyboard out of the page behind the overlay, which is inert.
  useEffect(() => { firstAge.current?.focus() }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="age-picker-title"
        className="w-full max-w-lg rounded-2xl border-2 border-border bg-card p-6 text-center shadow-card animate-pop"
      >
        <h2 id="age-picker-title" className="font-fredoka text-3xl font-bold">
          How old are you?
        </h2>
        <p className="mt-2 font-nunito text-muted-foreground">
          Tap your age and we&apos;ll pick the right words for you.
        </p>

        <div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-7">
          {AGES.map((age, index) => (
            <button
              key={age}
              ref={index === 0 ? firstAge : undefined}
              aria-label={`${age} years old`}
              onClick={() => {
                setAgeGroup(ageGroupForAge(age))
                onChosen()
              }}
              className="flex aspect-square items-center justify-center rounded-xl border-2
                         border-border bg-card font-fredoka text-2xl font-bold transition-all
                         hover:-translate-y-0.5 hover:border-primary hover:bg-primary/5 hover:text-primary
                         focus:border-primary focus:outline-none focus:ring-4 focus:ring-ring/30"
            >
              {age}
            </button>
          ))}
        </div>

        <p className="mt-5 font-nunito text-sm text-muted-foreground">
          You can change this any time at the top of the page.
        </p>
      </div>
    </div>
  )
}
