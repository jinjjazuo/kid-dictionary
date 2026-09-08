'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { config } from '@/config'
import { Button } from '@/components/ui/Button'
import { useAgeGroup } from '@/hooks/useAgeGroup'

/**
 * The primary entry point to the application.
 *
 * Input is capped at the configured length and trimmed before navigation, so
 * a stray space cannot create a second cache entry for the same word.
 */
export function SearchBar({ initialValue = '' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue)
  const router = useRouter()
  const { ageGroup } = useAgeGroup()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const word = value.trim().toLowerCase()
    if (!word) return
    router.push(`/search/${encodeURIComponent(word)}?ageGroup=${ageGroup}`)
  }

  return (
    <form onSubmit={handleSubmit} data-tour="search" className="mx-auto flex w-full max-w-xl gap-2">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        maxLength={config.word.maxInputLength}
        placeholder="Type any word..."
        aria-label="Search for a word"
        className="h-14 flex-1 rounded-lg border-2 border-border bg-card px-5
                   font-nunito text-lg text-foreground placeholder:text-muted-foreground
                   focus:border-primary focus:outline-none focus:ring-4 focus:ring-ring/30"
      />
      <Button type="submit" variant="playful" size="lg" disabled={!value.trim()}>
        Look up
      </Button>
    </form>
  )
}
