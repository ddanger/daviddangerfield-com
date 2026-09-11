#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { discoverPages, publicRoutes, ROOT_DIR } from './lib/routes.mjs'

const BASE_URL = (process.env.SITE_URL || 'https://daviddangerfield.com').replace(/\/$/, '')

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function gitDate(relativePath) {
  try {
    const output = execFileSync('git', ['log', '-1', '--format=%cs', '--', relativePath], {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return output || null
  } catch {
    return null
  }
}

function latestDate(a, b) {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

async function main() {
  const pages = await discoverPages(ROOT_DIR)
  const routes = []

  for (const page of publicRoutes(pages)) {
    const metaRel = path.relative(ROOT_DIR, page.metaPath)
    const contentRel = path.relative(ROOT_DIR, page.contentPath)

    const metaDate = gitDate(metaRel)
    const contentDate = gitDate(contentRel)
    const lastmod = latestDate(metaDate, contentDate) || new Date().toISOString().slice(0, 10)

    routes.push({ route: page.route, lastmod })
  }

  routes.sort((a, b) => a.route.localeCompare(b.route))

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ]

  for (const item of routes) {
    lines.push('  <url>')
    lines.push(`    <loc>${escapeXml(BASE_URL + item.route)}</loc>`)
    lines.push(`    <lastmod>${item.lastmod}</lastmod>`)
    lines.push('  </url>')
  }

  lines.push('</urlset>')
  lines.push('')

  await writeFile(path.join(ROOT_DIR, 'sitemap.xml'), lines.join('\n'), 'utf8')
  console.log(`Generated sitemap.xml with ${routes.length} URLs.`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
