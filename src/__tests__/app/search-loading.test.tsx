import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Loading from '@/app/search/[word]/loading'

describe('word page loading state', () => {
  it('announces that the lookup is in progress', () => {
    // role="status" rather than plain text: the search bar keeps focus
    // across the navigation, so without a live region a child using a
    // screen reader hears nothing at all for the ten seconds a cache miss
    // takes, which is the exact problem this screen exists to solve.
    render(<Loading />)

    expect(screen.getByRole('status')).toHaveTextContent(/looking up/i)
  })
})
