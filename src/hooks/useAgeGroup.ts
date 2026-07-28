'use client'

import { useCallback, useEffect, useState } from 'react'
import { config, type AgeGroup } from '@/config'

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
  }, [])

  const setAgeGroup = useCallback((next: AgeGroup) => {
    localStorage.setItem(config.storage.ageGroupKey, next)
    setStored(next)
  }, [])

  return { ageGroup, setAgeGroup, loading }
}
