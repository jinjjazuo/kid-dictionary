import { test, expect } from '@playwright/test'
import { seedWords, failOnConsoleErrors } from './fixtures'

test.describe('games', () => {
  test('both games gate below the minimum collection size', async ({ page }) => {
    await seedWords(page, 2)

    await page.goto('/games/quiz')
    await expect(page.getByRole('heading', { name: 'Almost ready!' })).toBeVisible()

    await page.goto('/games/crossword')
    await expect(page.getByRole('heading', { name: 'Almost ready!' })).toBeVisible()
  })

  test('a quiz round plays to a score at exactly the minimum', async ({ page }) => {
    // Four words is the boundary case: it yields exactly the three wrong
    // answers a four-choice question needs.
    const errors: string[] = []
    failOnConsoleErrors(page, errors)

    await seedWords(page, 4)
    await page.goto('/games/quiz')

    await expect(page.getByText('Question 1 of 4')).toBeVisible()

    for (let i = 0; i < 4; i++) {
      await page.locator('main button').filter({ hasNotText: /Next|See my score/ }).first().click()
      await page.getByRole('button', { name: /Next|See my score/ }).click()
    }

    await expect(page.getByText(/out of 4/)).toBeVisible()
    expect(errors).toEqual([])
  })

  test('the crossword renders a grid and clues', async ({ page }) => {
    const errors: string[] = []
    failOnConsoleErrors(page, errors)

    await seedWords(page, 6)
    await page.goto('/games/crossword')

    await expect(page.getByRole('button', { name: 'Check my answers' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Across' })).toBeVisible()
    expect(errors).toEqual([])
  })
})
