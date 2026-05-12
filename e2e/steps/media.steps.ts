import { expect } from '@playwright/test'
import { When, Then } from '@cucumber/cucumber'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NodeoWorld } from '../support/world.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(__dirname, '..', 'fixtures')

When('I click the upload media button', async function (this: NodeoWorld) {
  await this.page.getByRole('button', { name: 'Upload media' }).click()
})

When('I choose file {string} with title {string}', async function (this: NodeoWorld, fileName: string, title: string) {
  const filePath = path.join(fixturesDir, fileName)
  await this.page.locator('input[type="file"]').setInputFiles(filePath)
  await this.page.locator('#upl-title').fill(title)
})

When('I confirm the upload in the dialog', async function (this: NodeoWorld) {
  const dialog = this.page.getByRole('dialog').filter({ hasText: 'Add Media' })
  await dialog.getByRole('button', { name: 'Upload' }).click()
})

Then('the media {string} is ready', async function (this: NodeoWorld, title: string) {
  const card = this.page.locator('.media-card').filter({ hasText: title })
  const readyMarker = card.locator('.pi-headphones, img.thumb').first()
  const errorMarker = card.locator('.pi-exclamation-triangle')

  const winner = await Promise.race([
    readyMarker.waitFor({ state: 'visible', timeout: 300_000 }).then(() => 'ready' as const),
    errorMarker.waitFor({ state: 'visible', timeout: 300_000 }).then(() => 'error' as const),
  ])

  if (winner === 'error') {
    throw new Error(
      `Media "${title}" ended in error state instead of ready. `
      + 'Check backend logs (yt-dlp / ffmpeg failure or network issue).',
    )
  }
})

When('I click the delete button on media {string}', async function (this: NodeoWorld, title: string) {
  const card = this.page.locator('.media-card').filter({ hasText: title })
  await card.locator('.media-actions button').click()
})

Then('I see the delete confirmation dialog', async function (this: NodeoWorld) {
  const dialog = this.page.getByRole('dialog').filter({ hasText: 'Delete' })
  await expect(dialog).toBeVisible({ timeout: 5_000 })
})

When('I cancel the delete dialog', async function (this: NodeoWorld) {
  const dialog = this.page.getByRole('dialog').filter({ hasText: 'Delete' })
  await dialog.getByRole('button', { name: 'Cancel' }).click()
})

When('I confirm the delete dialog', async function (this: NodeoWorld) {
  const dialog = this.page.getByRole('dialog').filter({ hasText: 'Delete' })
  await dialog.getByRole('button', { name: 'Delete' }).click()
})

Then('the media {string} is visible', async function (this: NodeoWorld, title: string) {
  const card = this.page.locator('.media-card').filter({ hasText: title })
  await expect(card).toBeVisible({ timeout: 5_000 })
})

Then('the media {string} is gone', async function (this: NodeoWorld, title: string) {
  const card = this.page.locator('.media-card').filter({ hasText: title })
  await expect(card).toHaveCount(0, { timeout: 10_000 })
})

When('I switch to the External tab in the upload dialog', async function (this: NodeoWorld) {
  const dialog = this.page.getByRole('dialog').filter({ hasText: 'Add Media' })
  await dialog.getByRole('tab', { name: 'External' }).click()
})

When('I select the {string} plugin', async function (this: NodeoWorld, pluginName: string) {
  const dialog = this.page.getByRole('dialog').filter({ hasText: 'Add Media' })
  await dialog.locator('.plugin-card').filter({ hasText: pluginName }).click()
})

When('I enter YouTube URL {string}', async function (this: NodeoWorld, url: string) {
  await this.page.locator('#yt-url').fill(url)
})

When('I enter import title {string}', async function (this: NodeoWorld, title: string) {
  await this.page.locator('#yt-title').fill(title)
})

When('I click the import button', async function (this: NodeoWorld) {
  const dialog = this.page.getByRole('dialog').filter({ hasText: 'Add Media' })
  await dialog.getByRole('button', { name: 'Import' }).click()
})
