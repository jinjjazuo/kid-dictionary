import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { PlayWord } from '@/components/PlayWord'

/**
 * Hearing the word is the point of this control: a four-year-old cannot read
 * /ˈɹeɪnboʊ/, so for the younger band this is the only pronunciation that
 * actually works.
 */
describe('PlayWord', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('renders nothing when the word has no recording', () => {
    // Most words have none. An always-visible button that does nothing when
    // pressed is worse than no button.
    const { container } = render(<PlayWord word="rainbow" audioUrl={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('names the word it will say, for a screen reader', () => {
    render(<PlayWord word="rainbow" audioUrl="https://x/a.mp3" />)
    expect(screen.getByRole('button')).toHaveAccessibleName(/rainbow/i)
  })

  it('plays the recording when pressed', async () => {
    const play = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(play)

    render(<PlayWord word="rainbow" audioUrl="https://x/a.mp3" />)
    fireEvent.click(screen.getByRole('button'))

    expect(play).toHaveBeenCalled()
  })

  it('stays usable when playback is refused', async () => {
    // Browsers reject play() without a user gesture, and a rejected promise
    // here would surface as an unhandled rejection in the console.
    vi.spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockRejectedValue(new Error('NotAllowedError'))

    render(<PlayWord word="rainbow" audioUrl="https://x/a.mp3" />)
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByRole('button')).toBeEnabled()
  })
})
