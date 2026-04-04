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
  const dialog = this.page.getByRole('dialog').filter({ hasText: 'Upload Media' })
  await dialog.getByRole('button', { name: 'Upload' }).click()
})

Then('the media {string} is ready', async function (this: NodeoWorld, title: string) {
  const card = this.page.locator('.media-card').filter({ hasText: title })
  const readyMarker = card.locator('.pi-headphones, img.thumb').first()
  await expect(readyMarker).toBeVisible({ timeout: 300_000 })
})
