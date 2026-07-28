import { test, expect } from '@playwright/test'
import { seedWords, failOnConsoleErrors } from './fixtures'

test.describe('the collection', () => {
  test('saved words survive a reload', async ({ page }) => {
    // The core promise of localStorage persistence. If this breaks, a child
    // loses their collection on every visit.
    const errors: string[] = []
    failOnConsoleErrors(page, errors)

    await seedWords(page, 5)
    await page.goto('/dictionary')
    await expect(page.getByRole('link', { name: 'testword0' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('link', { name: 'testword0' })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('an empty collection shows the empty state, not a blank page', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.goto('/dictionary')
    await expect(page.getByRole('heading', { name: 'No words yet' })).toBeVisible()
  })

  test('a correct answer removes a word and a cancel keeps it', async ({ page }) => {
    await seedWords(page, 5)
    await page.goto('/dictionary')

    await page.getByRole('button', { name: 'Remove testword0' }).click()
    await expect(page.getByRole('heading', { name: 'One last question!' })).toBeVisible()

    await page.getByRole('button', { name: 'Cancel, keep this word' }).click()
    await expect(page.getByRole('link', { name: 'testword0' })).toBeVisible()

    await page.getByRole('button', { name: 'Remove testword0' }).click()
    // Seeded definitions are unique per word, so the correct choice is
    // identifiable without reading component state.
    await page.getByRole('button', { name: 'This is what testword0 means.' }).click()

    await expect(page.getByRole('link', { name: 'testword0' })).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('link', { name: 'testword0' })).toHaveCount(0)
  })
})
