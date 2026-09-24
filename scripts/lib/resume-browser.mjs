import { access } from 'node:fs/promises'
import { isAbsolute, join, normalize, relative } from 'node:path'
import { chromium } from 'playwright-core'

const ORIGIN = 'http://site.local'

// Playwright's pinned headless Chromium, not the installed Chrome: Chrome
// updates itself, and a new version can move line breaks between two builds
// of the same source. The browser changes only when playwright-core does.
export async function launchBrowser() {
  try {
    return await chromium.launch()
  } catch (err) {
    throw new Error(
      `Couldn't start Playwright's Chromium (${err.message.split('\n')[0]}). Run \`npm run setup:init\`, or \`npx playwright-core install chromium-headless-shell\`.`,
    )
  }
}

function distFileFor(distDir, url) {
  const decoded = decodeURIComponent(new URL(url).pathname)
  const file = normalize(join(distDir, decoded.endsWith('/') ? `${decoded}index.html` : decoded))
  const rel = relative(distDir, file)
  return rel.startsWith('..') || isAbsolute(rel) ? null : file
}

// Opens a dist/ route with the site served in-process and every other request
// blocked, so output can't depend on the network. `html` replaces the route's
// document without writing it to dist/, which a resume variant must never be.
export async function openDistPage(browser, distDir, route, { html, ...pageOptions } = {}) {
  const page = await browser.newPage(pageOptions)
  await page.route('**/*', (intercept) => intercept.abort())
  await page.route(`${ORIGIN}/**`, async (intercept) => {
    const url = intercept.request().url()
    if (html && new URL(url).pathname === route) {
      return intercept.fulfill({ body: html, contentType: 'text/html; charset=utf-8' })
    }
    const file = distFileFor(distDir, url)
    const exists =
      file &&
      (await access(file).then(
        () => true,
        () => false,
      ))
    return exists ? intercept.fulfill({ path: file }) : intercept.fulfill({ status: 404 })
  })
  await page.goto(`${ORIGIN}${route}`, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  return page
}

export { ORIGIN }
