'use client'

import { useState } from 'react'
import type { Scene } from '@/types'

/**
 * The generated comic and its scene text.
 *
 * The image is rendered with a plain <img> rather than next/image: the source
 * is an already-compressed WebP on a CDN with a one-year cache header, so
 * Next's optimiser would add a second round of processing for no gain.
 *
 * An image that fails to load hides itself and leaves the scene text, which
 * is the graceful-degradation requirement — a child must never see a broken
 * image icon where a story should be.
 *
 * `pending` is the drawing state, streamed in while the comic generates. It
 * is deliberately distinct from a null imageUrl, which means no comic is
 * coming at all — either it failed or the word is one whose illustration is
 * withheld. Showing a placeholder in that case would spin forever.
 */
export function ComicStrip({
  word,
  imageUrl,
  scenes,
  pending = false,
}: {
  word: string
  imageUrl: string | null
  scenes: Scene[]
  pending?: boolean
}) {
  const [imageFailed, setImageFailed] = useState(false)

  if (!imageUrl && scenes.length === 0) return null

  return (
    <section className="mt-8">
      <h2 className="mb-4 font-fredoka text-2xl font-bold">A story about {word}</h2>

      {/* Only ever reached with scenes present, so a comic really is coming. */}
      {pending && (
        <div
          data-testid="comic-pending"
          className="aspect-[3/2] w-full animate-pulse rounded-2xl border-2 border-border bg-muted"
        />
      )}

      {imageUrl && !imageFailed && (
        <img
          src={imageUrl}
          alt={`A comic strip showing what ${word} means`}
          onError={() => setImageFailed(true)}
          className="w-full rounded-2xl border-2 border-border shadow-card"
        />
      )}

      {scenes.length > 0 && (
        <ol className="mt-4 space-y-3">
          {scenes.map(scene => (
            <li key={scene.scene} className="flex gap-3 font-nunito text-lg">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                               bg-primary font-fredoka font-bold text-primary-foreground">
                {scene.scene}
              </span>
              <span className="pt-0.5">{scene.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
