'use client'

import { useRef } from 'react'

/**
 * Speaks the word aloud, using Wiktionary's own recording.
 *
 * This is the pronunciation that works for the younger band: a four-year-old
 * cannot read /ˈɹeɪnboʊ/, so the IPA line beside it is really for an adult
 * reading along. Most words have no recording, in which case nothing renders
 * rather than offering a button that does nothing.
 *
 * The <audio> element is created once and reused, so repeated presses restart
 * the same clip instead of stacking overlapping ones.
 */
export function PlayWord({ word, audioUrl }: { word: string; audioUrl: string | null }) {
  const audio = useRef<HTMLAudioElement | null>(null)

  if (!audioUrl) return null

  function play() {
    audio.current ??= new Audio(audioUrl!)
    audio.current.currentTime = 0
    // Browsers reject play() when they judge there was no user gesture. That
    // is not worth surfacing to a child, but it must not become an unhandled
    // rejection either.
    void audio.current.play().catch(() => {})
  }

  return (
    <button
      type="button"
      onClick={play}
      aria-label={`Hear the word ${word}`}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full
                 border-2 border-border bg-card text-primary transition-all
                 hover:border-primary hover:bg-primary/5 active:translate-y-0.5
                 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
    >
      {/* Speaker glyph. aria-hidden: the button's label already says it. */}
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        <path
          d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  )
}
