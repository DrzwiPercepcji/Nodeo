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
  await this.page.locator('textarea').fill(unescaped)
})

When('I save the cookie settings', async function (this: NodeoWorld) {
  await this.page.getByRole('button', { name: 'Save' }).click()
})

Then('the cookie status shows masked value', async function (this: NodeoWorld) {
  await expect(this.page.getByText('••••••••••••••••')).toBeVisible()
})
