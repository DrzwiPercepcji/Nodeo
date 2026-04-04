import { World, type IWorldOptions } from '@cucumber/cucumber'
import type { BrowserContext, Page } from '@playwright/test'

export class NodeoWorld extends World {
  context!: BrowserContext
  page!: Page

  constructor(options: IWorldOptions) {
    super(options)
  }
}
