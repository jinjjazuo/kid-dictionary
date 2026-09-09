import { test, expect } from '@playwright/test'
import { failOnConsoleErrors, skipOnboarding } from './fixtures'

test.describe('word lookup', () => {
  test('searching a word shows its definition and saves it', async ({ page }) => {
    // A cache miss can take up to the 60s assertion timeouts below (two model
    // calls plus image compression), so the test itself needs headroom past
    // the framework's 30s default or a slow-but-successful generation is
    // reported as a timeout rather than a real failure. The definition and the
    // save are now separate waits, hence the doubled budget.
    test.setTimeout(150_000)

    const errors: string[] = []
    failOnConsoleErrors(page, errors)

    await skipOnboarding(page)
    await page.getByLabel('Search for a word').fill('enormous')
    await page.getByRole('button', { name: 'Look up' }).click()

    // Generous: a cache miss runs two model calls plus image compression.
    // Exact match: the page also renders an "A story about enormous" heading
    // for the comic strip, which would otherwise match too.
    await expect(page.getByRole('heading', { name: 'enormous', exact: true }))
      .toBeVisible({ timeout: 60_000 })

    const definition = page.locator('main')
    await expect(definition).toContainText(/\w+/)

    // The word is saved once the comic resolves, which streams in well after
    // the definition — so this needs its own budget rather than the 5s
    // default it inherited back when the whole page arrived at once.
    await expect(page.getByText('Saved to My Words')).toBeVisible({ timeout: 60_000 })

    const stored = await page.evaluate(() => localStorage.getItem('kd.words.v1'))
    expect(stored).toContain('enormous')

    expect(errors).toEqual([])
  })

  test('shows a loading screen the moment Look up is clicked', async ({ page }) => {
    // The lookup is delayed deliberately. A word already in the cache can
    // answer in under a second, which would leave this assertion racing the
    // response; what is under test is that the screen changes at all, not how
    // long it stays changed.
    await page.route('**/search/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await route.continue()
    })

    await skipOnboarding(page)
    await page.getByLabel('Search for a word').fill('enormous')
    await page.getByRole('button', { name: 'Look up' }).click()

    await expect(page.getByRole('status')).toContainText(/looking up/i)
  })

  test('an unknown word shows the friendly message', async ({ page }) => {
    await page.goto('/search/qwertyuiopasdf')
    await expect(page.getByText(/don't know that word/i)).toBeVisible({ timeout: 30_000 })
  })
})
