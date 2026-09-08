import { test, expect } from '@playwright/test'
import { seedWords } from './fixtures'

/**
 * The home page is shorter than most windows, so without a growing hero the
 * stats strip lands wherever the content happens to end — mid-screen, with a
 * band of empty background under it. These specs pin it to the bottom of the
 * window instead. Geometry is why they are Playwright and not Vitest: jsdom
 * computes no layout, so a unit test cannot see this at all.
 */
test.describe('the home page layout', () => {
  test('puts the stats strip at the bottom of a tall window', async ({ page }) => {
    await seedWords(page, 2)
    await page.setViewportSize({ width: 1280, height: 1000 })
    await page.goto('/')

    const strip = page.getByRole('region', { name: 'Your collection' })
    await expect(strip).toBeVisible()

    const box = (await strip.boundingBox())!
    // Flush with the bottom edge, not floating above it.
    expect(box.y + box.height).toBeCloseTo(1000, 0)
  })

  test('keeps the strip below the hero when the window is short', async ({ page }) => {
    // The strip grows the page rather than overlaying it, so a child on a
    // laptop still scrolls past the search bar to reach it.
    await seedWords(page, 2)
    await page.setViewportSize({ width: 1280, height: 500 })
    await page.goto('/')

    const hero = page.getByRole('heading', { name: /Magic of Words/ })
    const strip = page.getByRole('region', { name: 'Your collection' })

    const heroBox = (await hero.boundingBox())!
    const stripBox = (await strip.boundingBox())!
    expect(stripBox.y).toBeGreaterThan(heroBox.y + heroBox.height)
  })
})
