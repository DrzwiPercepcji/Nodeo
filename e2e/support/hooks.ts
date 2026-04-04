import {
  After,
  AfterAll,
  Before,
  BeforeAll,
  setDefaultTimeout,
  setWorldConstructor,
} from '@cucumber/cucumber'
import { chromium, type Browser } from '@playwright/test'
import { NodeoWorld } from './world.js'

setWorldConstructor(NodeoWorld)
setDefaultTimeout(360_000)

const headless = process.env.PWHEADLESS !== '0'

let browser: Browser

BeforeAll(async () => {
  browser = await chromium.launch({ headless })
})

AfterAll(async () => {
  if (browser) await browser.close()
})

Before(async function (this: NodeoWorld) {
  this.context = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8080',
    ignoreHTTPSErrors: true,
  })
  this.page = await this.context.newPage()
})

After(async function (this: NodeoWorld) {
  await this.context?.close()
})
