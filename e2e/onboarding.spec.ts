import { test, expect, type Page } from '@playwright/test'
import { failOnConsoleErrors } from './fixtures'

/**
 * First launch: pick a reading level, then a three-step tour.
 *
 * These are e2e rather than unit tests because the whole feature is defined by
 * things jsdom cannot produce — an overlay that must not swallow the search
 * bar's clicks, and a spotlight positioned from a real `getBoundingClientRect`.
 */

/** Puts the browser in the state a visitor who has never opened the app is in. */
async function firstLaunch(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
}

const picker = (page: Page) => page.getByRole('dialog', { name: 'How old are you?' })
const tour = (page: Page) => page.getByRole('dialog', { name: 'App tour' })

test.describe('first launch', () => {
  test('asks for a reading level before anything else', async ({ page }) => {
    const errors: string[] = []
    failOnConsoleErrors(page, errors)

    await firstLaunch(page)

    await expect(picker(page)).toBeVisible()
    // Every age a child of this app can be, each its own button.
    await expect(picker(page).getByRole('button')).toHaveCount(7)

    // 8 falls in the older band, so the range mapping is what is under test
    // here — not just that a button stores whatever it says.
    await picker(page).getByRole('button', { name: '8 years old' }).click()

    await expect(picker(page)).toBeHidden()
    expect(await page.evaluate(() => localStorage.getItem('kd.ageGroup.v1'))).toBe('7-10')
    // The header toggle stays, and agrees with what was just chosen.
    await expect(page.getByRole('radio', { name: 'Ages 7–10' })).toBeChecked()

    expect(errors).toEqual([])
  })

  test('walks three steps and then never returns', async ({ page }) => {
    await firstLaunch(page)
    await picker(page).getByRole('button', { name: '5 years old' }).click()

    await expect(tour(page)).toContainText('Type any word')
    await tour(page).getByRole('button', { name: 'Next' }).click()

    await expect(tour(page)).toContainText('Your words are saved')
    await tour(page).getByRole('button', { name: 'Next' }).click()

    await expect(tour(page)).toContainText('Play with your words')
    await tour(page).getByRole('button', { name: "Let's go!" }).click()

    await expect(tour(page)).toBeHidden()
    await page.reload()
    await expect(picker(page)).toBeHidden()
    await expect(tour(page)).toBeHidden()
  })

  test('spotlights the search box it is describing', async ({ page }) => {
    // A tour that renders but points at empty space is the failure worth
    // catching, and only real layout can show it.
    await firstLaunch(page)
    await picker(page).getByRole('button', { name: '5 years old' }).click()

    const input = (await page.getByLabel('Search for a word').boundingBox())!
    const spotlight = (await page.getByTestId('tour-spotlight').boundingBox())!

    expect(spotlight.x).toBeLessThanOrEqual(input.x)
    expect(spotlight.y).toBeLessThanOrEqual(input.y)
    expect(spotlight.x + spotlight.width).toBeGreaterThanOrEqual(input.x + input.width)
    expect(spotlight.y + spotlight.height).toBeGreaterThanOrEqual(input.y + input.height)
  })

  test('skipping leaves a usable page', async ({ page }) => {
    await firstLaunch(page)
    await picker(page).getByRole('button', { name: '5 years old' }).click()
    await tour(page).getByRole('button', { name: 'Skip' }).click()

    await expect(tour(page)).toBeHidden()
    // The overlay is gone rather than merely transparent: a child must be able
    // to type immediately after skipping.
    await page.getByLabel('Search for a word').fill('rainbow')
    await expect(page.getByRole('button', { name: 'Look up' })).toBeEnabled()

    await page.reload()
    await expect(picker(page)).toBeHidden()
  })

  test('a younger age lands in the younger band', async ({ page }) => {
    await firstLaunch(page)
    await picker(page).getByRole('button', { name: '6 years old' }).click()

    expect(await page.evaluate(() => localStorage.getItem('kd.ageGroup.v1'))).toBe('4-6')
    await expect(page.getByRole('radio', { name: 'Ages 4–6' })).toBeChecked()
  })

  test('a returning visitor sees neither', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('kd.onboarded.v1', '1'))
    await page.reload()

    await expect(picker(page)).toBeHidden()
    await expect(tour(page)).toBeHidden()
    await expect(page.getByRole('radio', { name: 'Ages 4–6' })).toBeVisible()
  })
})
