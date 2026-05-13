import { expect } from '@playwright/test'
import { When, Then } from '@cucumber/cucumber'
import type { NodeoWorld } from '../support/world.js'

When('I click the settings button', async function (this: NodeoWorld) {
  await this.page.getByRole('button', { name: 'Settings' }).click()
})

Then('I see the settings page', async function (this: NodeoWorld) {
  await expect(this.page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(this.page.getByText('YouTube (yt-dlp)')).toBeVisible()
})

Then('the cookie status shows {string}', async function (this: NodeoWorld, text: string) {
  await expect(this.page.getByText(text)).toBeVisible()
})

When('I click the upload cookie button', async function (this: NodeoWorld) {
  await this.page.getByRole('button', { name: 'Upload' }).click()
})

When('I enter cookie data {string}', async function (this: NodeoWorld, data: string) {
  const unescaped = data.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
  await this.page.getByPlaceholder('Paste Netscape cookie file content here').fill(unescaped)
})

When('I save the cookie settings', async function (this: NodeoWorld) {
  const saveBtn = this.page.getByRole('button', { name: 'Save' })
  await expect(saveBtn).toBeEnabled({ timeout: 10_000 })

  const matchesPut = (r: { url: () => string; request: () => { method: () => string } }) =>
    r.url().includes('/settings/ytdlp-cookies') && r.request().method() === 'PUT'

  const [response] = await Promise.all([
    this.page.waitForResponse(matchesPut, { timeout: 15_000 }),
    saveBtn.click(),
  ])

  if (!response.ok()) {
    const body = await response.text().catch(() => '')
    throw new Error(
      `PUT /api/settings/ytdlp-cookies failed: HTTP ${response.status()} ${response.statusText()}. Body: ${body.slice(0, 500)}`,
    )
  }
})

Then('the cookie status shows masked value', async function (this: NodeoWorld) {
  await expect(this.page.getByTestId('ytdlp-cookies-masked')).toBeVisible()
})
