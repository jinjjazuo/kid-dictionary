import { describe, it, expect } from 'vitest'
import { buildEnrichmentPrompt, buildStoryPrompt, buildComicImagePrompt, parseJsonResponse } from '@/lib/claude'

describe('buildEnrichmentPrompt', () => {
  it('uses simpler language for young group', () => {
    const prompt = buildEnrichmentPrompt('enormous', 'Very large in size.', '4-6')
    expect(prompt).toContain('5-year-old')
    expect(prompt).toContain('enormous')
    expect(prompt).toContain('Very large in size.')
  })

  it('uses richer language for older group', () => {
    const prompt = buildEnrichmentPrompt('enormous', 'Very large in size.', '7-10')
    expect(prompt).toContain('9-year-old')
  })
})

describe('buildStoryPrompt', () => {
  it('requests 3 scenes for young group', () => {
    const prompt = buildStoryPrompt('enormous', '4-6')
    expect(prompt).toContain('3-scene')
    expect(prompt).toContain('5-year-old')
  })

  it('requests 5 scenes for older group', () => {
    const prompt = buildStoryPrompt('enormous', '7-10')
    expect(prompt).toContain('5-scene')
    expect(prompt).toContain('9-year-old')
  })
})

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

describe('parseJsonResponse', () => {
  it('parses valid JSON', () => {
    const result = parseJsonResponse('{"definition": "Big.", "examples": ["The elephant was enormous."]}')
    expect(result).toEqual({ definition: 'Big.', examples: ['The elephant was enormous.'] })
  })

  it('extracts JSON from markdown code blocks', () => {
    const result = parseJsonResponse('```json\n{"definition": "Big."}\n```')
    expect(result).toEqual({ definition: 'Big.' })
  })

  it('returns null for invalid JSON', () => {
    const result = parseJsonResponse('not json at all')
    expect(result).toBeNull()
  })
})
