import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ComicStrip } from '@/components/ComicStrip'

const SCENES = [
  { scene: 1, text: 'One.' },
  { scene: 2, text: 'Two.' },
]

/**
 * The comic arrives tens of seconds after the definition, so the strip has
 * three states, not two: drawing, drawn, and never-coming. Conflating the
 * first and last would either spin forever on a word whose comic was
 * withheld, or show nothing at all while one is being drawn.
 */
describe('ComicStrip', () => {
  it('shows the story text and a placeholder while the comic is drawing', () => {
    render(<ComicStrip word="rainbow" imageUrl={null} scenes={SCENES} pending />)

    // The scene text comes from the text phase, so it is readable straight away.
    expect(screen.getByText('One.')).toBeInTheDocument()
    expect(screen.getByTestId('comic-pending')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows the comic once it has arrived', () => {
    render(<ComicStrip word="rainbow" imageUrl="https://cdn.example/c.webp" scenes={SCENES} />)

    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.example/c.webp')
    expect(screen.queryByTestId('comic-pending')).not.toBeInTheDocument()
  })

  it('shows no placeholder for a word whose comic was withheld', () => {
    // A sensitive word gets a definition and no story, so nothing is coming
    // and a placeholder would spin forever.
    const { container } = render(
      <ComicStrip word="death" imageUrl={null} scenes={[]} pending />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('keeps the story text when the comic failed to generate', () => {
    render(<ComicStrip word="rainbow" imageUrl={null} scenes={SCENES} />)

    expect(screen.getByText('One.')).toBeInTheDocument()
    expect(screen.queryByTestId('comic-pending')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
