'use client'

import { useCallback, useEffect, useState } from 'react'
import { config, type AgeGroup } from '@/config'

/**
 * Notifies every mounted useAgeGroup() instance in this tab of a change.
 *
 * The browser's native `storage` event only fires in *other* tabs, never the
 * one that made the write, so the header's toggle and the search bar's own
 * useAgeGroup() call — two independent useState instances in two different
 * component trees — would otherwise never learn about each other's write.
 * Without this, flipping the toggle updates the header but leaves the next
 * search running at the old age group until a full page reload.
 */
const listeners = new Set<(next: AgeGroup) => void>()

/**
 * The reading level used for new lookups, persisted in localStorage.
 *
 * A deliberately lightweight preference rather than an onboarding step: a
 * child can search immediately, and an adult can change it in one tap if the
 * content reads too young.
 *
 * Changing it does not rewrite saved words. Each SavedWord records the age
 * group it was generated for, so a collection may legitimately hold both.
 */
export function useAgeGroup() {
  const [ageGroup, setStored] = useState<AgeGroup>(config.defaultAgeGroup)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const raw = localStorage.getItem(config.storage.ageGroupKey)
    // Anything unrecognised degrades to the default rather than being trusted.
    if (raw === '4-6' || raw === '7-10') setStored(raw)
    setLoading(false)

    listeners.add(setStored)
    return () => { listeners.delete(setStored) }
  }, [])

  const setAgeGroup = useCallback((next: AgeGroup) => {
    localStorage.setItem(config.storage.ageGroupKey, next)
    for (const listener of listeners) listener(next)
  }, [])

  return { ageGroup, setAgeGroup, loading }
}
