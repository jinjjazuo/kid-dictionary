'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * The tour, in order. `anchor` matches a `data-tour` attribute in the markup
 * rather than a CSS class or a ref, so restyling a component cannot silently
 * detach the step that points at it.
 */
const STEPS = [
  {
    anchor: 'search',
    title: 'Type any word',
    body: "We'll explain what it means and draw a comic about it.",
  },
  {
    anchor: 'collection',
    title: 'Your words are saved',
    body: 'Every word you look up is kept here in My Words.',
  },
  {
    anchor: 'games',
    title: 'Play with your words',
    body: 'Turn your collection into a quiz or a crossword.',
  },
]

/** Breathing room between the highlighted element and the dimmed area. */
const SPOTLIGHT_PADDING = 8
/** Fixed rather than fluid: the card is positioned in JS and needs its width up front. */
const CARD_WIDTH = 288
const CARD_GAP = 12
const VIEWPORT_MARGIN = 16
/** One element paints the whole dim: a hole with a shadow larger than any screen. */
const DIM = `0 0 0 9999px hsl(var(--foreground) / 0.5)`

type Frame = { top: number; left: number; width: number; height: number; vw: number; vh: number }

/**
 * A three-step walkthrough of the home page.
 *
 * Positions come from a live `getBoundingClientRect` on each step rather than
 * from hardcoded coordinates, because the header wraps to two rows on a phone
 * and the search bar moves with it.
 *
 * If a step's anchor is missing the tour ends instead of stalling — a dimmed
 * screen with nothing to click is the one failure a child cannot recover from,
 * and it is exactly what a future edit to the header would cause.
 *
 * @param onFinish Runs on the last step, on Skip, and on Escape — every exit
 *                 records onboarding as done
 */
export function Tour({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0)
  const [frame, setFrame] = useState<Frame | null>(null)

  const measure = useCallback(() => {
    const element = document.querySelector(`[data-tour="${STEPS[step].anchor}"]`)
    if (!element) {
      onFinish()
      return
    }
    // A short window can leave the anchor below the fold, where the card would
    // point off-screen.
    element.scrollIntoView({ block: 'center' })
    const rect = element.getBoundingClientRect()
    setFrame({
      top: rect.top - SPOTLIGHT_PADDING,
      left: rect.left - SPOTLIGHT_PADDING,
      width: rect.width + SPOTLIGHT_PADDING * 2,
      height: rect.height + SPOTLIGHT_PADDING * 2,
      vw: window.innerWidth,
      vh: window.innerHeight,
    })
  }, [step, onFinish])

  useEffect(() => {
    measure()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onFinish() }
    window.addEventListener('resize', measure)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [measure, onFinish])

  if (!frame) return null

  const isLast = step === STEPS.length - 1
  // Below the anchor when there is room under it, above it otherwise.
  const placeBelow = frame.top + frame.height < frame.vh / 2
  const left = Math.min(
    Math.max(VIEWPORT_MARGIN, frame.left + frame.width / 2 - CARD_WIDTH / 2),
    frame.vw - CARD_WIDTH - VIEWPORT_MARGIN,
  )

  return (
    <>
      {/* Transparent, and only here to swallow clicks: navigating away
          mid-tour would leave onboarding unrecorded and replay it next visit. */}
      <div className="fixed inset-0 z-40" />

      <div
        data-testid="tour-spotlight"
        className="pointer-events-none fixed z-50 rounded-xl"
        style={{
          top: frame.top,
          left: frame.left,
          width: frame.width,
          height: frame.height,
          boxShadow: DIM,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="App tour"
        className="fixed z-50 rounded-2xl border-2 border-border bg-card p-4 shadow-card animate-pop"
        style={{
          width: CARD_WIDTH,
          left,
          top: placeBelow ? frame.top + frame.height + CARD_GAP : undefined,
          bottom: placeBelow ? undefined : frame.vh - frame.top + CARD_GAP,
        }}
      >
        <p className="font-nunito text-xs font-bold uppercase tracking-wide text-primary">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 className="mt-1 font-fredoka text-lg font-bold">{STEPS[step].title}</h2>
        <p className="mt-1 font-nunito text-sm text-muted-foreground">{STEPS[step].body}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            onClick={onFinish}
            className="rounded-lg px-3 py-2 font-nunito text-sm font-bold text-muted-foreground
                       hover:bg-muted hover:text-foreground"
          >
            Skip
          </button>
          <button
            onClick={() => (isLast ? onFinish() : setStep(step + 1))}
            className="rounded-lg bg-primary px-4 py-2 font-nunito font-bold text-primary-foreground
                       transition-transform hover:-translate-y-0.5"
          >
            {isLast ? "Let's go!" : 'Next'}
          </button>
        </div>
      </div>
    </>
  )
}
