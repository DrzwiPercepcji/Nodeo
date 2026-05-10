import { expect } from '@playwright/test'
import { Given, When, Then } from '@cucumber/cucumber'
import type { NodeoWorld } from '../support/world.js'

// 1x1 red PNG (68 bytes) — minimal valid image for mocking
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64',
)

Given('cover art requests are mocked', async function (this: NodeoWorld) {
  await this.page.route('**/media/*/cover-art**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: TINY_PNG,
    })
  })
})

When('I open the audio playlist', async function (this: NodeoWorld) {
  await this.page.getByRole('button', { name: 'Open audio playlist' }).click()
  await expect(this.page.locator('.now-playing')).toBeVisible({ timeout: 10_000 })
})

Then('the now-playing artwork shows a cover image', async function (this: NodeoWorld) {
  const img = this.page.locator('.artwork .artwork-img')
  await expect(img).toBeVisible({ timeout: 10_000 })
})

Then('each queue item shows a cover thumbnail', async function (this: NodeoWorld) {
  const items = this.page.locator('.queue-item')
  const count = await items.count()
  expect(count).toBeGreaterThanOrEqual(3)

  for (let i = 0; i < count; i++) {
    const thumb = items.nth(i).locator('.qi-art')
    await expect(thumb).toBeVisible({ timeout: 5_000 })
  }
})
