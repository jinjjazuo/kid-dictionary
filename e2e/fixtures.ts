import type { Page } from '@playwright/test'

/**
 * Seeds the collection directly rather than by looking words up.
 *
 * Real lookups take around ten seconds each and consume AI quota, so specs
 * that test the collection, the quiz or the crossword write to localStorage
 * instead. Only the lookup spec exercises the pipeline.
 */
export async function seedWords(page: Page, count: number) {
  const words = Array.from({ length: count }, (_, i) => ({
    word: `testword${i}`,
    definition: `This is what testword${i} means.`,
    partOfSpeech: 'noun',
    examples: [`Here is testword${i} in a sentence.`],
    synonyms: [],
    phonetic: null,
    comicImageUrl: null,
    ageGroup: '4-6',
    textVersion: 1,
    addedAt: new Date(Date.now() - i * 1000).toISOString(),
  }))

  // A page must be loaded before localStorage is reachable for this origin.
  await page.goto('/')
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key as string, value as string),
    ['kd.words.v1', JSON.stringify(words)],
  )
}

/** Fails a spec on any console error — this is the point of the suite. */
export function failOnConsoleErrors(page: Page, errors: string[]) {
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
}
