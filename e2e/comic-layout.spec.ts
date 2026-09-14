import { test, expect, type Page } from '@playwright/test'
import { skipOnboarding } from './fixtures'

/**
 * Where the story pointers sit relative to the comic.
 *
 * Comics are square, so stacked in one column the image alone fills a laptop
 * window and a child reading "3. Now the plant has an enormous melon" has to
 * scroll away from the panel it describes. On a wide window the pointers move
 * beside the picture; on a narrow one there is no room, so they stay below.
 *
 * Uses "rainbow" because it is a home page suggestion with a cached comic, so
 * this spec does not spend image quota. Geometry is the whole assertion, which
 * is why this is Playwright and not Vitest.
 */

const WORD = 'rainbow'
/** The frame's own border. Any inset beyond it is padding. */
const FRAME_BORDER_PX = 2

async function openWord(page: Page, width: number, height: number) {
  await skipOnboarding(page)
  await page.setViewportSize({ width, height })
  await page.goto(`/search/${WORD}`)
}

const comic = (page: Page) => page.getByRole('img', { name: /comic strip/ })
const pointers = (page: Page) =>
  page.locator('section', { has: page.getByRole('heading', { name: `A story about ${WORD}` }) })
    .getByRole('list')

test.describe('the comic and its story', () => {
  test('sit side by side, in one window, on a wide screen', async ({ page }) => {
    await openWord(page, 1440, 900)
    await expect(comic(page)).toBeVisible({ timeout: 60_000 })

    const image = (await comic(page).boundingBox())!
    const list = (await pointers(page).boundingBox())!

    expect(list.x).toBeGreaterThanOrEqual(image.x + image.width)
    expect(list.y).toBeLessThan(image.y + image.height)
    // The point of the change: scrolled to the comic, nothing is off-screen.
    const top = Math.min(image.y, list.y)
    const bottom = Math.max(image.y + image.height, list.y + list.height)
    expect(bottom - top).toBeLessThanOrEqual(900)
  })

  test('stack on a narrow screen', async ({ page }) => {
    await openWord(page, 800, 900)
    await expect(comic(page)).toBeVisible({ timeout: 60_000 })

    const image = (await comic(page).boundingBox())!
    const list = (await pointers(page).boundingBox())!
    expect(list.y).toBeGreaterThanOrEqual(image.y + image.height)
  })

  test('keep the art off the edge of its frame', async ({ page }) => {
    // Comics are cropped to their artwork before upload. A comic drawn without
    // panel borders would otherwise run straight into the frame and have its
    // corners cut off by the rounding.
    await openWord(page, 1440, 900)
    await expect(comic(page)).toBeVisible({ timeout: 60_000 })

    const image = (await comic(page).boundingBox())!
    const frame = (await comic(page).locator('xpath=..').boundingBox())!
    const insets = [
      image.x - frame.x,
      image.y - frame.y,
      frame.x + frame.width - (image.x + image.width),
      frame.y + frame.height - (image.y + image.height),
    ]
    for (const inset of insets) expect(inset).toBeGreaterThan(FRAME_BORDER_PX)
  })

  test('take the full width when the picture fails', async ({ page }) => {
    // A two-column layout with the picture hidden would leave the story in a
    // half-width column beside an empty one.
    //
    // The failure is delayed past hydration on purpose. This spec is about
    // layout once the strip knows the image failed, not about whether an
    // error fired before React attached its handler.
    await page.route('**/*', async route => {
      if (route.request().resourceType() !== 'image') return route.continue()
      await new Promise(resolve => setTimeout(resolve, 1500))
      await route.abort()
    })
    await openWord(page, 1440, 900)

    await expect(comic(page)).toBeHidden({ timeout: 60_000 })
    const section = page.locator('section', {
      has: page.getByRole('heading', { name: `A story about ${WORD}` }),
    })
    const sectionBox = (await section.boundingBox())!
    const list = (await pointers(page).boundingBox())!
    expect(list.width).toBeCloseTo(sectionBox.width, 0)
  })
})
