import { expect } from '@playwright/test'
import { When, Then } from '@cucumber/cucumber'
import type { NodeoWorld } from '../support/world.js'

When('I create a collection named {string}', async function (this: NodeoWorld, name: string) {
  await this.page.getByRole('button', { name: 'New Collection' }).click()
  await this.page.locator('#col-name').fill(name)
  await this.page.getByRole('button', { name: 'Create' }).click()
})

When('I create an encrypted collection named {string} with passphrase {string}', async function (this: NodeoWorld, name: string, passphrase: string) {
  await this.page.getByRole('button', { name: 'New Collection' }).click()
  await this.page.locator('#col-name').fill(name)
  await this.page.locator('#col-enc').click()
  await this.page.locator('#col-pass input').fill(passphrase)
  await this.page.getByRole('button', { name: 'Create' }).click()
})

When('I open the collection {string}', async function (this: NodeoWorld, name: string) {
  await this.page.getByRole('heading', { level: 3, name }).click()
})

Then('I see the collection card {string}', async function (this: NodeoWorld, name: string) {
  await expect(this.page.getByRole('heading', { level: 3, name })).toBeVisible({ timeout: 30_000 })
})

Then('I do not see the collection card {string}', async function (this: NodeoWorld, name: string) {
  await expect(this.page.getByRole('heading', { level: 3, name })).not.toBeVisible({ timeout: 5_000 })
})

Then('the collection page shows title {string}', async function (this: NodeoWorld, name: string) {
  await expect(this.page.getByRole('heading', { level: 1, name })).toBeVisible({ timeout: 30_000 })
})

Then('I see the private collections toggle showing {int}', async function (this: NodeoWorld, count: number) {
  const toggle = this.page.locator('.private-toggle')
  await expect(toggle).toBeVisible({ timeout: 5_000 })
  await expect(toggle).toContainText(`Private collections (${count})`)
})

When('I expand the private collections section', async function (this: NodeoWorld) {
  await this.page.locator('.private-toggle').click()
})

When('I collapse the private collections section', async function (this: NodeoWorld) {
  await this.page.locator('.private-toggle').click()
})
