#!/usr/bin/env node

import https from 'node:https'
import { discoverPages, publicRoutes, ROOT_DIR } from './lib/routes.mjs'

const BASE_URL = (process.env.SITE_URL || 'https://daviddangerfield.com').replace(/\/$/, '')
const TIMEOUT_MS = 12000

function checkRoute(route) {
  const url = `${BASE_URL}${route}`
  return new Promise((resolve) => {
    const started = Date.now()
    const req = https.get(url, { timeout: TIMEOUT_MS }, (res) => {
      const duration = Date.now() - started
      res.resume()
      const status = res.statusCode || 0
      resolve({
        route,
        url,
        status,
        duration,
        ok: status >= 200 && status <= 399,
        error: '',
      })
    })

    req.on('timeout', () => {
      req.destroy(new Error('timeout'))
    })

    req.on('error', (err) => {
      const duration = Date.now() - started
      resolve({
        route,
        url,
        status: 0,
        duration,
        ok: false,
        error: err.message || 'request failed',
      })
    })
  })
}

function printSummary(results) {
  console.log('| Route | Status | Duration (ms) | Result |')
  console.log('| --- | ---: | ---: | --- |')

  for (const item of results) {
    const marker = item.ok ? 'PASS' : `FAIL${item.error ? ` (${item.error})` : ''}`
    console.log(`| ${item.route} | ${item.status || '-'} | ${item.duration} | ${marker} |`)
  }
}

async function discoverUptimeRoutes() {
  const pages = await discoverPages(ROOT_DIR)
  return publicRoutes(pages)
    .map((page) => page.route)
    .sort()
}

async function main() {
  const routes = await discoverUptimeRoutes()
  if (routes.length === 0) {
    console.error('No uptime routes discovered from source pages.')
    process.exit(1)
  }

  const results = []
  for (const route of routes) {
    // Sequential checks preserve deterministic output order.
    // eslint-disable-next-line no-await-in-loop
    const result = await checkRoute(route)
    results.push(result)
  }

  printSummary(results)

  const failures = results.filter((item) => !item.ok)
  if (failures.length > 0) {
    console.error(`Uptime check failed for ${failures.length} route(s).`)
    process.exit(1)
  }

  console.log(`Uptime check passed for ${results.length} route(s).`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
