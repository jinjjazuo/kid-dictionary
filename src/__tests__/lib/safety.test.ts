import { describe, it, expect } from 'vitest'
import { checkWord } from '@/lib/safety/check'

describe('checkWord', () => {
  it('allows an ordinary word', () => {
    expect(checkWord('dinosaur')).toBe('allowed')
    expect(checkWord('rainbow')).toBe('allowed')
  })

  it('marks a difficult but legitimate word as sensitive', () => {
    // A child asking what "death" means deserves an answer. The definition
    // is the useful part; only the illustration is withheld.
    expect(checkWord('death')).toBe('sensitive')
    expect(checkWord('war')).toBe('sensitive')
    expect(checkWord('gun')).toBe('sensitive')
  })

  it('blocks a word that should never reach a model', () => {
    expect(checkWord('porn')).toBe('blocked')
  })

  it('ignores case and surrounding whitespace', () => {
    expect(checkWord('  DEATH  ')).toBe('sensitive')
    expect(checkWord('Porn')).toBe('blocked')
  })

  it('does not match a list entry inside a longer unrelated word', () => {
    // "war" must not make "warm", "reward" or "wardrobe" sensitive.
    expect(checkWord('warm')).toBe('allowed')
    expect(checkWord('reward')).toBe('allowed')
    expect(checkWord('wardrobe')).toBe('allowed')
  })

  it('treats an empty input as allowed', () => {
    // Input validation is the caller's job; this function only classifies.
    expect(checkWord('')).toBe('allowed')
  })
})
