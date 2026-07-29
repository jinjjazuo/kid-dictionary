import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAgeGroup } from '@/hooks/useAgeGroup'

describe('useAgeGroup', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts at the default age group', async () => {
    const { result } = renderHook(() => useAgeGroup())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.ageGroup).toBe('4-6')
  })

  it('propagates a change to a second, independently mounted instance', async () => {
    // The header toggle and the search bar each call useAgeGroup() in their
    // own component tree. A child who flips the toggle expects the very
    // next search to use the new reading level — if the two hook instances
    // do not share state, the search bar silently keeps searching at the
    // old age group after the toggle visibly changed.
    const header = renderHook(() => useAgeGroup())
    const searchBar = renderHook(() => useAgeGroup())

    await waitFor(() => expect(header.result.current.loading).toBe(false))
    await waitFor(() => expect(searchBar.result.current.loading).toBe(false))

    act(() => {
      header.result.current.setAgeGroup('7-10')
    })

    await waitFor(() => expect(searchBar.result.current.ageGroup).toBe('7-10'))
  })
})
