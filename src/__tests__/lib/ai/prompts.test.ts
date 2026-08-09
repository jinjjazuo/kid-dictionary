import { describe, it, expect } from 'vitest'
import {
  wordContentSystemPrompt, wordContentUserPrompt, parseWordContent,
  buildImagePrompt, parseJsonResponse, keepExamplesUsingWord,
} from '@/lib/ai/prompts'
import { config } from '@/config'

describe('wordContentSystemPrompt', () => {
  it('states an explicit vocabulary ceiling for young readers', () => {
    // "Use simple words" is too vague to be reliable. The prompt must name
    // the age and forbid reaching for a harder word.
    const prompt = wordContentSystemPrompt('4-6', 3)
    expect(prompt).toMatch(/5-year-old|five-year-old/i)
    expect(prompt.toLowerCase()).toContain('only words')
  })

  it('asks older readers for richer language', () => {
    expect(wordContentSystemPrompt('7-10', 5)).toMatch(/9-year-old|nine-year-old/i)
  })

  it('forbids defining a word with itself', () => {
    expect(wordContentSystemPrompt('4-6', 3).toLowerCase()).toContain('must not contain the word')
  })

  it('requests the configured number of examples', () => {
    expect(wordContentSystemPrompt('4-6', 3)).toContain(String(config.word.maxExamples))
  })

  it('carries the story rules when scenes are requested', () => {
    const prompt = wordContentSystemPrompt('4-6', 3).toLowerCase()
    // A story that never uses the word teaches nothing.
    expect(prompt).toContain('must use the word')
    expect(prompt).toContain('same character')
    expect(prompt).toMatch(/nothing (scary|frightening)/)
  })

  it('omits the story entirely for a sensitive word', () => {
    // Sensitive words get a definition but no comic. Asking the model for
    // scenes anyway would waste tokens and invite unusable output.
    const prompt = wordContentSystemPrompt('4-6', 0).toLowerCase()
    expect(prompt).not.toContain('scene')
    expect(prompt).not.toContain('story')
  })
})

describe('wordContentUserPrompt', () => {
  it('carries the word, the raw definition and the scene count', () => {
    const prompt = wordContentUserPrompt('enormous', 'very large in size', '4-6', 3)
    expect(prompt).toContain('enormous')
    expect(prompt).toContain('very large in size')
    expect(prompt).toContain('3')
  })

  it('does not ask for scenes when none are wanted', () => {
    expect(wordContentUserPrompt('death', 'the end of life', '4-6', 0).toLowerCase())
      .not.toContain('scene')
  })
})

describe('parseWordContent', () => {
  const FULL = JSON.stringify({
    definition: 'Very, very big.',
    examples: ['The elephant is enormous.', 'My bag is enormous.'],
    scenes: [{ scene: 1, text: 'A.' }, { scene: 2, text: 'B.' }, { scene: 3, text: 'C.' }],
  })

  it('parses a full payload', () => {
    expect(parseWordContent(FULL, 'enormous', 3)).toEqual({
      definition: 'Very, very big.',
      examples: ['The elephant is enormous.', 'My bag is enormous.'],
      scenes: [{ scene: 1, text: 'A.' }, { scene: 2, text: 'B.' }, { scene: 3, text: 'C.' }],
    })
  })

  it('returns null on unparseable output', () => {
    expect(parseWordContent('sorry, I cannot do that', 'x', 3)).toBeNull()
  })

  it('returns null when the definition is missing', () => {
    // Parseable but useless. A row with no definition has no value, so the
    // pipeline must treat this as failure rather than cache it.
    expect(parseWordContent('{"examples":["a"],"scenes":[]}', 'x', 3)).toBeNull()
  })

  it('drops examples that never use the word', () => {
    const raw = JSON.stringify({
      definition: 'Very, very big.',
      examples: ['The dog is so big and tall.', 'The elephant is enormous.'],
      scenes: [{ scene: 1, text: 'A.' }, { scene: 2, text: 'B.' }, { scene: 3, text: 'C.' }],
    })
    expect(parseWordContent(raw, 'enormous', 3)?.examples)
      .toEqual(['The elephant is enormous.'])
  })

  it('keeps the text but nulls the scenes on a scene-count mismatch', () => {
    // The panel highlight overlay divides the image into sceneCount equal
    // columns, so a wrong-length script would misalign every panel. The
    // definition is still good — only the story is discarded.
    const raw = JSON.stringify({
      definition: 'Very, very big.',
      examples: ['The elephant is enormous.'],
      scenes: [{ scene: 1, text: 'Only one.' }],
    })
    expect(parseWordContent(raw, 'enormous', 3)).toEqual({
      definition: 'Very, very big.',
      examples: ['The elephant is enormous.'],
      scenes: null,
    })
  })

  it('nulls the scenes when any scene text is empty', () => {
    const raw = JSON.stringify({
      definition: 'Very, very big.',
      examples: ['The elephant is enormous.'],
      scenes: [{ scene: 1, text: 'A.' }, { scene: 2, text: '' }, { scene: 3, text: 'C.' }],
    })
    expect(parseWordContent(raw, 'enormous', 3)?.scenes).toBeNull()
  })

  it('renumbers scenes sequentially regardless of what the model wrote', () => {
    const raw = JSON.stringify({
      definition: 'Very, very big.',
      examples: ['The elephant is enormous.'],
      scenes: [{ scene: 7, text: 'A.' }, { scene: 7, text: 'B.' }, { scene: 2, text: 'C.' }],
    })
    expect(parseWordContent(raw, 'enormous', 3)?.scenes)
      .toEqual([{ scene: 1, text: 'A.' }, { scene: 2, text: 'B.' }, { scene: 3, text: 'C.' }])
  })

  it('returns empty scenes when none were requested, even if the model sent some', () => {
    // Sensitive path: the comic must never exist, whatever the model does.
    expect(parseWordContent(FULL, 'enormous', 0)?.scenes).toEqual([])
  })
})

describe('buildImagePrompt', () => {
  it('states the panel count explicitly', () => {
    // The count must be explicit or the model produces an arbitrary number
    // of panels and the comic no longer matches the script.
    const prompt = buildImagePrompt([
      { scene: 1, text: 'A boy in a garden.' },
      { scene: 2, text: 'He sees an elephant.' },
      { scene: 3, text: 'He laughs.' },
    ])
    expect(prompt).toContain('3')
    expect(prompt).toContain('A boy in a garden.')
    expect(prompt).toContain('He laughs.')
  })

  it('describes every panel in order', () => {
    const prompt = buildImagePrompt([
      { scene: 1, text: 'First.' },
      { scene: 2, text: 'Second.' },
    ])
    expect(prompt.indexOf('First.')).toBeLessThan(prompt.indexOf('Second.'))
  })
})

describe('keepExamplesUsingWord', () => {
  it('keeps examples containing the word', () => {
    expect(keepExamplesUsingWord(['The elephant was enormous.'], 'enormous'))
      .toEqual(['The elephant was enormous.'])
  })

  it('drops examples that omit the word', () => {
    expect(keepExamplesUsingWord(['The dog is so big and tall.'], 'enormous'))
      .toEqual([])
  })

  it('matches case-insensitively', () => {
    expect(keepExamplesUsingWord(['Enormous waves crashed on the shore.'], 'enormous'))
      .toEqual(['Enormous waves crashed on the shore.'])
  })

  it('allows a suffix on the word', () => {
    expect(keepExamplesUsingWord(['She smiled enormously at the gift.'], 'enormous'))
      .toEqual(['She smiled enormously at the gift.'])
  })

  it('drops a bare synonym that never uses the word', () => {
    expect(keepExamplesUsingWord(['The castle was gigantic and tall.'], 'enormous'))
      .toEqual([])
  })

  it('returns an empty array for an empty word', () => {
    expect(keepExamplesUsingWord(['Anything at all.'], '')).toEqual([])
    expect(keepExamplesUsingWord(['Anything at all.'], '   ')).toEqual([])
  })

  it('does not throw on regex-special characters in the word', () => {
    expect(() => keepExamplesUsingWord(['I love c++ programming.'], 'c++')).not.toThrow()
  })
})

describe('parseJsonResponse', () => {
  it('parses clean JSON', () => {
    expect(parseJsonResponse<{ a: number }>('{"a":1}')).toEqual({ a: 1 })
  })

  it('parses JSON wrapped in a markdown fence', () => {
    // Models add fences despite being asked for raw JSON.
    expect(parseJsonResponse('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseJsonResponse('```\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('parses JSON surrounded by prose', () => {
    expect(parseJsonResponse('Here you go: {"a":1} Hope that helps!')).toEqual({ a: 1 })
  })

  it('parses a bare array', () => {
    expect(parseJsonResponse('[{"scene":1,"text":"Hi"}]')).toEqual([{ scene: 1, text: 'Hi' }])
  })

  it('returns null on unparseable output rather than throwing', () => {
    // The pipeline treats null as a normal degradation. A throw here would
    // take down the whole request instead of dropping one optional step.
    expect(parseJsonResponse('not json at all')).toBeNull()
    expect(parseJsonResponse('')).toBeNull()
    expect(parseJsonResponse('{broken')).toBeNull()
  })
})
