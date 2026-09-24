#!/usr/bin/env node
/**
 * Rebuilds the resume PDF and its link-preview image from src/pages/resume/,
 * then stops for review. Nothing is committed; the committed PDF is the
 * reviewed one. Run it here, not in CI: the resume uses the macOS Arial font.
 */

import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundleJs } from './bundle-js.mjs'
import { build } from './build.mjs'
import { launchBrowser } from './lib/resume-browser.mjs'
import { printResumePdf } from './lib/resume-pdf.mjs'
import { renderResumeShare } from './lib/resume-share.mjs'
import { hashResumeSource, RESUME_PDF } from './lib/resume-source.mjs'

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url))
const DIST_DIR = join(ROOT_DIR, 'dist')
const SITE_JSON = join(ROOT_DIR, 'src', 'site.json')
const SHARE_IMAGE = 'images/social/resume-share.png'

function parseArgs(argv) {
  const args = { open: process.platform === 'darwin' }
  for (const token of argv) {
    if (token === '--no-open') {
      args.open = false
    } else if (token === '--help' || token === '-h') {
      console.log(`
Usage: npm run update:resume [-- --no-open]

Builds the site, prints ${RESUME_PDF} from /resume/, checks it (two pages,
no Type 3 fonts, text matches the page), renders ${SHARE_IMAGE}, and records
the resume source hash in src/site.json. On macOS it opens both files for
review.
`)
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${token}`)
    }
  }
  return args
}

async function buildSite() {
  await bundleJs()
  await build()
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  await buildSite()

  // Printed to a scratch file first: a draft that fails its checks stays
  // there for inspection and never replaces the reviewed PDF.
  const scratch = await mkdtemp(join(tmpdir(), 'resume-'))
  const draftPdf = join(scratch, RESUME_PDF)
  const browser = await launchBrowser()
  try {
    const { pages } = await printResumePdf(browser, DIST_DIR, draftPdf)
    await copyFile(draftPdf, join(ROOT_DIR, RESUME_PDF))
    console.log(`\n  ✓ ${RESUME_PDF} (${pages} pages, text matches the page)`)

    await renderResumeShare(browser, ROOT_DIR, DIST_DIR, join(ROOT_DIR, SHARE_IMAGE))
    console.log(`  ✓ ${SHARE_IMAGE}`)
  } finally {
    await browser.close()
  }
  await rm(scratch, { recursive: true, force: true })

  const site = JSON.parse(await readFile(SITE_JSON, 'utf8'))
  site.resumeSourceHash = await hashResumeSource(ROOT_DIR)
  await writeFile(SITE_JSON, `${JSON.stringify(site, null, 2)}\n`, 'utf8')
  console.log(`  ✓ src/site.json resumeSourceHash ${site.resumeSourceHash}`)

  // The PDF's links carry a hash of the PDF, so rebuild with the new one.
  await buildSite()

  console.log(`\nReview ${RESUME_PDF} and ${SHARE_IMAGE}, then commit them with src/site.json.`)
  if (args.open) {
    spawnSync('open', [join(ROOT_DIR, RESUME_PDF), join(ROOT_DIR, SHARE_IMAGE)])
  }
}

main().catch((err) => {
  console.error(`\nResume update failed: ${err.message}`)
  process.exit(1)
})
