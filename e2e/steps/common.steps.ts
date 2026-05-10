import { expect } from '@playwright/test'
import { Given, When, Then } from '@cucumber/cucumber'
import type { NodeoWorld } from '../support/world.js'

Given('I am on the login page', async function (this: NodeoWorld) {
  await this.page.goto('/login')
  await expect(this.page.getByText('Private media streaming')).toBeVisible()
})

Given('I am logged in as {string} with password {string}', async function (this: NodeoWorld, user: string, password: string) {
  await this.page.goto('/login')
  await this.page.locator('#username').fill(user)
  await this.page.locator('#password').fill(password)
  await this.page.getByRole('button', { name: 'Sign in' }).click()
  await expect(this.page.getByRole('heading', { name: 'Collections' })).toBeVisible()
})

When('I click the log out button', async function (this: NodeoWorld) {
  await this.page.getByRole('button', { name: 'Log out' }).click()
})

Then('I see the login page', async function (this: NodeoWorld) {
  await expect(this.page).toHaveURL(/\/login$/)
  await expect(this.page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

Then('I see the collections list', async function (this: NodeoWorld) {
  await expect(this.page.getByRole('heading', { name: 'Collections' })).toBeVisible()
})

Then('I see a login error message', async function (this: NodeoWorld) {
  await expect(this.page.getByText('Login failed')).toBeVisible()
})
