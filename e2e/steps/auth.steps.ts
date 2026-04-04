import { When } from '@cucumber/cucumber'
import type { NodeoWorld } from '../support/world.js'

When('I enter username {string} and password {string}', async function (this: NodeoWorld, user: string, password: string) {
  await this.page.locator('#username').fill(user)
  await this.page.locator('#password').fill(password)
})

When('I click the sign in button', async function (this: NodeoWorld) {
  await this.page.getByRole('button', { name: 'Sign in' }).click()
})
