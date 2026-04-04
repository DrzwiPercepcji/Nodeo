import { expect } from '@playwright/test'
import { When, Then } from '@cucumber/cucumber'
import type { NodeoWorld } from '../support/world.js'

When('I create a collection named {string}', async function (this: NodeoWorld, name: string) {
  await this.page.getByRole('button', { name: 'New Collection' }).click()
  await this.page.locator('#col-name').fill(name)
  await this.page.getByRole('button', { name: 'Create' }).click()
})

When('I open the collection {string}', async function (this: NodeoWorld, name: string) {
  await this.page.getByRole('heading', { level: 3, name }).click()
})

Then('I see the collection card {string}', async function (this: NodeoWorld, name: string) {
  await expect(this.page.getByRole('heading', { level: 3, name })).toBeVisible({ timeout: 30_000 })
})

Then('the collection page shows title {string}', async function (this: NodeoWorld, name: string) {
  await expect(this.page.getByRole('heading', { level: 1, name })).toBeVisible({ timeout: 30_000 })
})
