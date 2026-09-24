#!/usr/bin/env node
/**
 * Tailored resume variants, in applications/<name>/ (git-ignored: variants
 * show where David is applying and are never committed).
 *
 * First run: copies the canonical resume data into the folder to edit.
 * Later runs: renders that data through the same template and print CSS as
 * /resume/, checks the PDF like update:resume does, and writes the PDF and a
 * review.md listing every difference from the canonical resume.
 */

import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundleJs } from './bundle-js.mjs'
import { build } from './build.mjs'
import { launchBrowser } from './lib/resume-browser.mjs'
import { diffResumes } from './lib/resume-diff.mjs'
import { renderResume } from './lib/resume-html.mjs'
import { EXPECTED_PAGES, printResumePdf } from './lib/resume-pdf.mjs'
import { RESUME_PDF } from './lib/resume-source.mjs'

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url))
const DIST_DIR = join(ROOT_DIR, 'dist')
const CANONICAL = join(ROOT_DIR, 'src', 'pages', 'resume', 'resume.json')
const APPLICATIONS_DIR = join(ROOT_DIR, 'applications')

function usage() {
  return `
Usage: npm run resume:variant -- <name> [--pages <n>] [--no-open]

  <name>       folder under applications/, like acme-staff-frontend
  --pages <n>  expected page count (default ${EXPECTED_PAGES})
  --no-open    don't open the PDF and review.md (macOS opens them by default)

The first run creates applications/<name>/resume.json, a copy of the canonical
resume to edit (save the job posting beside it as posting.md). Each later run
writes applications/<name>/${RESUME_PDF} and review.md.
`
}

function parseArgs(argv) {
  const args = { name: '', pages: EXPECTED_PAGES, open: process.platform === 'darwin' }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--help' || token === '-h') {
      console.log(usage())
      process.exit(0)
    } else if (token === '--no-open') {
      args.open = false
    } else if (token === '--pages') {
      args.pages = Number(argv[i + 1])
      i += 1
      if (!Number.isInteger(args.pages) || args.pages < 1) throw new Error('--pages needs a number')
    } else if (!args.name && !token.startsWith('-')) {
      args.name = token
    } else {
      throw new Error(`Unknown argument: ${token}\n${usage()}`)
    }
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(args.name)) {
    throw new Error(`Give the variant a lowercase-hyphenated name.\n${usage()}`)
  }
  return args
}

const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  )

async function createVariant(dir, dataPath) {
  await mkdir(dir, { recursive: true })
  const data = JSON.parse(await readFile(CANONICAL, 'utf8'))
  data.$schema = relative(dir, join(ROOT_DIR, 'src', 'pages', 'resume', 'resume.schema.json'))
  await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  console.log(`Created ${relative(ROOT_DIR, dataPath)}, a copy of the canonical resume.`)
  console.log('Edit it (and save the job posting beside it as posting.md), then run this again.')
}

// The built /resume/ page with its article swapped for the variant's, so the
// variant gets the page's exact CSS and fonts.
async function variantHtml(variant) {
  const page = await readFile(join(DIST_DIR, 'resume', 'index.html'), 'utf8')
  const article = /<article class="?resume"?>[\s\S]*?<\/article>/
  if (!article.test(page)) throw new Error('No <article class="resume"> in dist/resume/index.html')
  return page.replace(article, () => renderResume(variant))
}

function reviewMarkdown(name, pdfPages, diff) {
  return `# Resume variant: ${name}

Built ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. ${RESUME_PDF}: ${pdfPages} pages; fonts and extracted text checked.

## Text not in the canonical resume

Check each line is true and something you'd stand behind in an interview.

${diff.newText}

## Changes from the canonical resume

${diff.changes}
`
}

async function buildVariant(args, dir, dataPath) {
  const variant = JSON.parse(await readFile(dataPath, 'utf8'))
  const canonical = JSON.parse(await readFile(CANONICAL, 'utf8'))
  const diff = diffResumes(canonical, variant)

  await bundleJs()
  await build()
  const html = await variantHtml(variant)

  const scratch = await mkdtemp(join(tmpdir(), 'resume-variant-'))
  const draftPdf = join(scratch, RESUME_PDF)
  const browser = await launchBrowser()
  let pages
  try {
    ;({ pages } = await printResumePdf(browser, DIST_DIR, draftPdf, {
      html,
      expectedPages: args.pages,
    }))
  } finally {
    await browser.close()
  }
  const pdfPath = join(dir, RESUME_PDF)
  await copyFile(draftPdf, pdfPath)
  await rm(scratch, { recursive: true, force: true })

  const reviewPath = join(dir, 'review.md')
  await writeFile(reviewPath, reviewMarkdown(args.name, pages, diff), 'utf8')

  console.log(`\n  ✓ ${relative(ROOT_DIR, pdfPath)} (${pages} pages, text matches the page)`)
  console.log(
    `  ✓ ${relative(ROOT_DIR, reviewPath)} (${diff.changeCount} changed sections, ${diff.newCount} new lines to check)`,
  )
  if (args.open) spawnSync('open', [pdfPath, reviewPath])
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const dir = join(APPLICATIONS_DIR, args.name)
  const dataPath = join(dir, 'resume.json')
  if (await exists(dataPath)) {
    await buildVariant(args, dir, dataPath)
  } else {
    await createVariant(dir, dataPath)
  }
}

main().catch((err) => {
  console.error(`\nResume variant failed: ${err.message}`)
  process.exit(1)
})
