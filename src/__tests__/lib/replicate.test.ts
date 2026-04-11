import { describe, it, expect } from 'vitest'
import { buildComicImagePrompt } from '@/lib/claude'

// Tests the prompt builder (pure function, no API call needed in tests)
describe('buildComicImagePrompt', () => {
  it('includes all panel descriptions', () => {
    const scenes = [
      { scene: 1, text: 'Tim finds a surprise.' },
      { scene: 2, text: 'An enormous elephant!' },
      { scene: 3, text: 'They become friends.' },
    ]
    const prompt = buildComicImagePrompt(scenes, 3)
    expect(prompt).toContain('exactly 3 equal-width vertical panels')
    expect(prompt).toContain('Panel 1: Tim finds a surprise.')
    expect(prompt).toContain('Panel 3: They become friends.')
  })
})
