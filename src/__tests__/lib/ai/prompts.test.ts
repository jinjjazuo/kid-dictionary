import { describe, it, expect } from 'vitest'
import {
  enrichSystemPrompt, enrichUserPrompt,
  storySystemPrompt, storyUserPrompt,
  buildImagePrompt, parseJsonResponse,
} from '@/lib/ai/prompts'
import { config } from '@/config'

describe('enrichment prompts', () => {
  it('states an explicit vocabulary ceiling for young readers', () => {
    // "Use simple words" is too vague to be reliable. The prompt must name
    // the age and forbid reaching for a harder word.
    const prompt = enrichSystemPrompt('4-6')
    expect(prompt).toMatch(/5-year-old|five-year-old/i)
    expect(prompt.toLowerCase()).toContain('only words')
  })

  it('asks older readers for richer language', () => {
    expect(enrichSystemPrompt('7-10')).toMatch(/9-year-old|nine-year-old/i)
  })

  it('forbids defining a word with itself', () => {
    expect(enrichSystemPrompt('4-6').toLowerCase()).toContain('never use the word')
  })

  it('requests the configured number of examples', () => {
    expect(enrichSystemPrompt('4-6')).toContain(String(config.word.maxExamples))
  })

  it('carries the word and the raw definition', () => {
    const prompt = enrichUserPrompt('enormous', 'very large in size', '4-6')
    expect(prompt).toContain('enormous')
    expect(prompt).toContain('very large in size')
  })
})

describe('story prompts', () => {
  it('requires the target word to appear', () => {
    // A story that never uses the word teaches nothing.
    expect(storySystemPrompt('4-6').toLowerCase()).toContain('must use the word')
  })

  it('forbids frightening content', () => {
    expect(storySystemPrompt('4-6').toLowerCase()).toMatch(/nothing (scary|frightening)/)
  })

  it('asks for one recurring character', () => {
    expect(storySystemPrompt('4-6').toLowerCase()).toContain('same character')
  })

  it('carries the word and the scene count', () => {
    const prompt = storyUserPrompt('enormous', 3)
    expect(prompt).toContain('enormous')
    expect(prompt).toContain('3')
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
