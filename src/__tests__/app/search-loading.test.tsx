import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Loading from '@/app/search/[word]/loading'

/**
 * The loading fallback is what makes clicking "Look up" feel responsive.
 *
 * Without a loading.tsx in this segment, the App Router holds the old page on
 * screen for the whole server render — on a cache miss that is the dictionary
 * API plus two AI calls — and the click appears to do nothing.
 */
describe('search loading fallback', () => {
  it('announces itself to assistive technology', () => {
    render(<Loading />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('tells the reader the word is on its way', () => {
    render(<Loading />)
    expect(screen.getByRole('status')).toHaveAccessibleName(/looking up your word/i)
  })
})
