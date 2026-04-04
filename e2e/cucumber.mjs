/** @type {import('@cucumber/cucumber').IConfiguration} */
export default {
  paths: ['features/**/*.feature'],
  import: ['support/world.ts', 'support/hooks.ts', 'steps/**/*.ts'],
  format: ['@cucumber/pretty-formatter'],
  formatOptions: { snippetInterface: 'async-await' },
  publishQuiet: true,
}
