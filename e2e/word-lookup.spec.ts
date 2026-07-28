import { test, expect } from '@playwright/test'
import { failOnConsoleErrors } from './fixtures'

test.describe('word lookup', () => {
  test('searching a word shows its definition and saves it', async ({ page }) => {
    const errors: string[] = []
    failOnConsoleErrors(page, errors)

    await page.goto('/')
    await page.getByLabel('Search for a word').fill('enormous')
    await page.getByRole('button', { name: 'Look up' }).click()

    // Generous: a cache miss runs two model calls plus image compression.
    // Exact match: the page also renders an "A story about enormous" heading
    // for the comic strip, which would otherwise match too.
    await expect(page.getByRole('heading', { name: 'enormous', exact: true }))
      .toBeVisible({ timeout: 60_000 })

    const definition = page.locator('main')
    await expect(definition).toContainText(/\w+/)

    await expect(page.getByText('Saved to My Words')).toBeVisible()

    const stored = await page.evaluate(() => localStorage.getItem('kd.words.v1'))
    expect(stored).toContain('enormous')

    expect(errors).toEqual([])
  })

  test('an unknown word shows the friendly message', async ({ page }) => {
    await page.goto('/search/qwertyuiopasdf')
    await expect(page.getByText(/don't know that word/i)).toBeVisible({ timeout: 30_000 })
  })
})
