#!/usr/bin/env node

// Screenshots routes at several widths and color schemes, and reports axe
// violations, horizontal overflow, console errors, failed requests, and
// (with --lighthouse) Lighthouse mobile scores. See SKILL.md for usage.

import { execFile, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, normalize, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { AxeBuilder } from '@axe-core/playwright'
import { chromium } from 'playwright'

const SKILL_DIR = fileURLToPath(new URL('.', import.meta.url))
const CONFIG_FILE = '.visual-check.json'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
}

function parseArgs(argv) {
  const opts = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`)
    const [key, inline] = arg.slice(2).split('=', 2)
    const boolean = ['lighthouse', 'no-axe', 'no-build', 'viewport-only'].includes(key)
    opts[key] = boolean ? true : (inline ?? argv[++i])
  }
  return opts
}

async function loadConfig(cwd) {
  const file = join(cwd, CONFIG_FILE)
  return existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : {}
}

const list = (value) => (Array.isArray(value) ? value : String(value).split(',')).filter(Boolean)

// Clean URLs: /about/ and /about both resolve to about/index.html, and /about
// to about.html, which covers most static hosts.
async function resolveFile(root, pathname) {
  const base = normalize(join(root, decodeURIComponent(pathname)))
  if (!base.startsWith(root)) return null
  for (const candidate of [base, join(base, 'index.html'), `${base}.html`]) {
    const info = await stat(candidate).catch(() => null)
    if (info?.isFile()) return candidate
  }
  return null
}

function serve(dir) {
  const root = resolve(dir)
  const server = createServer(async (req, res) => {
    const file = await resolveFile(root, new URL(req.url, 'http://x').pathname)
    const notFound = file ? null : await resolveFile(root, '/404.html')
    const target = file || notFound
    if (!target) {
      res.writeHead(404).end('Not found')
      return
    }
    res.writeHead(file ? 200 : 404, {
      'Content-Type': MIME[extname(target)] || 'application/octet-stream',
    })
    res.end(await readFile(target))
  })
  return new Promise((done) => {
    server.listen(0, '127.0.0.1', () => {
      done({ server, url: `http://127.0.0.1:${server.address().port}` })
    })
  })
}

// Sitemap URLs name the production origin; only their paths are used.
async function sitemapRoutes(source, baseUrl, cwd) {
  const xml = /^https?:/.test(source)
    ? await (await fetch(source)).text()
    : existsSync(join(cwd, source))
      ? await readFile(join(cwd, source), 'utf8')
      : await (await fetch(new URL(source, baseUrl))).text()
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => new URL(m[1]).pathname)
}

const slug = (route) => route.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-') || 'home'

async function checkPage(browser, url, width, theme, opts) {
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 800 : 900 },
    colorScheme: theme,
    deviceScaleFactor: 1,
    isMobile: width < 600,
    hasTouch: width < 600,
  })
  const page = await context.newPage()
  const consoleErrors = []
  const failedRequests = []
  page.on('console', (msg) => msg.type() === 'error' && consoleErrors.push(msg.text()))
  page.on('pageerror', (err) => consoleErrors.push(err.message))
  page.on('requestfailed', (req) => failedRequests.push(`${req.url()} (${req.failure()?.errorText})`))
  page.on('response', (res) => res.status() >= 400 && failedRequests.push(`${res.url()} (${res.status()})`))

  const response = await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)

  // A full-page screenshot doesn't scroll, so scroll-reveal content and lazy
  // images would stay hidden.
  await page.evaluate(async () => {
    const pause = (ms) => new Promise((r) => setTimeout(r, ms))
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo(0, y)
      await pause(100)
    }
    window.scrollTo(0, 0)
    await pause(800)
  })
  await page.waitForLoadState('networkidle')

  const overflow = await page.evaluate(() => {
    const limit = document.documentElement.clientWidth
    if (document.documentElement.scrollWidth <= limit) return []
    return [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > limit + 1)
      .filter((el) => !el.parentElement || el.parentElement.getBoundingClientRect().right <= limit + 1)
      .slice(0, 5)
      .map((el) => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : ''))
  })

  const shot = join(opts.out, `${slug(new URL(url).pathname)}-${width}-${theme}.png`)
  await page.screenshot({ path: shot, fullPage: !opts['viewport-only'] })

  let violations = []
  if (!opts['no-axe']) {
    const results = await new AxeBuilder({ page }).analyze()
    violations = results.violations.map((v) => {
      const targets = v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')
      const more = v.nodes.length > 3 ? `, +${v.nodes.length - 3} more` : ''
      return `${v.id} (${v.impact}): ${v.help} [${targets}${more}]`
    })
  }

  await context.close()
  return { status: response?.status(), shot, overflow, consoleErrors, failedRequests, violations }
}

async function lighthouse(url, out) {
  const bin = join(SKILL_DIR, 'node_modules', '.bin', 'lighthouse')
  const report = join(out, `lighthouse-${slug(new URL(url).pathname)}.json`)
  await promisify(execFile)(
    bin,
    [url, '--quiet', '--output=json', `--output-path=${report}`, '--chrome-flags=--headless=new --no-sandbox'],
    { env: { ...process.env, CHROME_PATH: chromium.executablePath() }, maxBuffer: 1 << 26 },
  )
  const { categories, audits } = JSON.parse(await readFile(report, 'utf8'))
  const scores = Object.values(categories).map((c) => `${c.title} ${Math.round(c.score * 100)}`)
  const failing = Object.values(audits)
    .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'informative')
    .map((a) => a.title)
  return { scores, failing }
}

async function main() {
  const cwd = process.cwd()
  const opts = { ...(await loadConfig(cwd)), ...parseArgs(process.argv.slice(2)) }
  opts.out = resolve(opts.out || join(tmpdir(), `visual-check-${Date.now()}`))
  await mkdir(opts.out, { recursive: true })

  if (opts.build && !opts['no-build'] && !opts.url) {
    console.error(`Building: ${opts.build}`)
    execSync(opts.build, { cwd, stdio: ['ignore', 'ignore', 'inherit'] })
  }

  let server
  let baseUrl = opts.url
  if (!baseUrl) {
    if (!opts.serve) throw new Error(`Pass --url or --serve <dir>, or set one in ${CONFIG_FILE}`)
    ;({ server, url: baseUrl } = await serve(join(cwd, opts.serve)))
  }
  baseUrl = baseUrl.replace(/\/$/, '')

  const routes = opts.routes
    ? list(opts.routes)
    : opts.sitemap
      ? await sitemapRoutes(opts.sitemap, baseUrl, cwd)
      : ['/']
  const widths = list(opts.widths || '375,768,1280').map(Number)
  const themes = list(opts.themes || 'light,dark')

  const browser = await chromium.launch()
  const lines = [`# Visual check: ${baseUrl}`, '', `Screenshots: ${opts.out}`, '']
  let problems = 0

  try {
    for (const route of routes) {
      const url = `${baseUrl}${route}`
      lines.push(`## ${route}`)
      for (const width of widths) {
        for (const theme of themes) {
          const r = await checkPage(browser, url, width, theme, opts)
          const issues = [
            r.status >= 400 && `HTTP ${r.status}`,
            ...r.overflow.map((o) => `horizontal overflow: ${o}`),
            ...r.consoleErrors.map((e) => `console: ${e}`),
            ...r.failedRequests.map((f) => `request failed: ${f}`),
            ...r.violations.map((v) => `axe: ${v}`),
          ].filter(Boolean)
          problems += issues.length
          lines.push(`- ${width}px ${theme}: ${issues.length ? '' : 'OK'}`)
          issues.forEach((i) => lines.push(`  - ${i}`))
        }
      }
      if (opts.lighthouse) {
        const lh = await lighthouse(url, opts.out)
        lines.push(`- Lighthouse (mobile): ${lh.scores.join(', ')}`)
        lh.failing.forEach((f) => lines.push(`  - ${f}`))
      }
      lines.push('')
    }
  } finally {
    await browser.close()
    server?.close()
  }

  const summary = lines.join('\n')
  await writeFile(join(opts.out, 'summary.md'), summary)
  console.log(summary)
  process.exit(problems ? 1 : 0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(2)
})
