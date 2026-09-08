import { describe, it, expect } from 'vitest'
import { config, getAgeGroupConfig } from '@/config'

describe('config', () => {
  it('has two age groups with different scene counts', () => {
    expect(config.ageGroups.young.label).toBe('4-6')
    expect(config.ageGroups.older.label).toBe('7-10')
    expect(config.ageGroups.young.sceneCount).toBe(3)
    expect(config.ageGroups.older.sceneCount).toBe(5)
  })

  it('resolves an age group to its scene count', () => {
    expect(getAgeGroupConfig('4-6').sceneCount).toBe(3)
    expect(getAgeGroupConfig('7-10').sceneCount).toBe(5)
  })

  it('tracks content versions independently', () => {
    expect(config.content.textVersion).toBe(2)
    expect(config.content.imageVersion).toBe(1)
  })

  it('never asks for more choices than the minimum collection can supply', () => {
    // A question needs mcqChoices - 1 wrong answers, and they come only
    // from the user's other saved words. Exceeding the minimum makes a
    // question unbuildable for a user who just unlocked the games.
    expect(config.games.mcqChoices).toBeLessThanOrEqual(config.games.minWordsRequired)
  })

  it('defaults to the younger age group', () => {
    expect(config.defaultAgeGroup).toBe('4-6')
  })

  it('versions its localStorage keys', () => {
    // Versioned so a future shape change cannot crash returning users.
    expect(config.storage.wordsKey).toBe('kd.words.v1')
    expect(config.storage.ageGroupKey).toBe('kd.ageGroup.v1')
  })

  it('compresses images enough to fit the Supabase free tier', () => {
    expect(config.images.format).toBe('webp')
    expect(config.images.quality).toBeLessThanOrEqual(85)
    expect(config.images.cacheSeconds).toBe(31536000)
  })

  it('gives up on the dictionary lookup long before an AI call', () => {
    // dictionaryapi.dev does not 404 an unknown word — it hangs until
    // Cloudflare cuts it off with a 522 at ~20s. A real word answers in about
    // 130ms, so the two calls cannot share one budget: a child's typo would
    // wait out the AI timeout before seeing "we don't know that word".
    expect(config.network.dictionaryTimeoutMs).toBeLessThanOrEqual(5000)
    expect(config.network.requestTimeoutMs).toBeGreaterThan(
      config.network.dictionaryTimeoutMs,
    )
  })
})
