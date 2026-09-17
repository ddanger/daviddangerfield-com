/**
 * BUILD-TIME ONLY — never imported by browser code.
 *
 * Assembles static HTML pages from:
 *   src/site.json                     — shared site config (GA, theme)
 *   styles.css                        — inlined into each page <head>
 *   src/partials/layout.html          — full document shell
 *   src/partials/header.html          — shared <header>
 *   src/partials/footer.html          — shared <footer> (with schedule-link token)
 *   src/pages/{page}/content.html     — per-page <main> content
 *   src/pages/{page}/meta.json        — per-page metadata, outputPath, footer config
 *   src/partials/resume-redirect.html — the bare resume/cv meta-refresh pages
 *
 * Pages are auto-discovered by scanning src/pages/ subdirectories (see
 * scripts/lib/routes.mjs). To add a page: create src/pages/{page}/content.html
 * and meta.json. The two resume-redirect pages are a fixed, separate list
 * (scripts/lib/resume-redirects.mjs) since they don't share layout.html.
 *
 * Output: overwrites each route's static HTML file in-place.
 *
 * Usage: node scripts/build.mjs — or import { build } from './build.mjs'
 * to run it in-process (see dev.mjs).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { discoverPages } from './lib/routes.mjs'
import { missingRequiredFields } from './lib/meta-schema.mjs'
import { RESUME_REDIRECTS } from './lib/resume-redirects.mjs'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(SCRIPTS_DIR, '..')
const SRC_DIR = join(ROOT_DIR, 'src')

// ---------------------------------------------------------------------------
// Template interpolation
// Tokens are {{UPPER_SNAKE_CASE}}. Unknown tokens throw so nothing silently
// falls through as a literal placeholder string.
// ---------------------------------------------------------------------------
function interpolate(template, vars) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => {
    if (key in vars) return vars[key]
    throw new Error(`Unknown template variable: {{${key}}}`)
  })
}

// ---------------------------------------------------------------------------
// Build the full <head> content string from page config + site config.
// All optional fields (keywords, robots, og:image, twitter, schema) are
// omitted when absent so each page ships exactly the tags it needs.
// stylesCss is inlined to avoid a render-blocking stylesheet request.
// ---------------------------------------------------------------------------
function buildHeadContent(page, site, stylesCss) {
  const lines = []

  lines.push(`  <meta charset="UTF-8" />`)
  lines.push(`  <meta name="viewport" content="width=device-width, initial-scale=1" />`)
  lines.push(`  <title>${page.meta.title}</title>`)
  lines.push(`  <meta name="description" content="${page.meta.description}" />`)

  // Load Google Analytics lazily: on the first interaction, or a few seconds
  // after load for visitors who never interact. Loading it on `load` put
  // gtag.js (~172 KB) in the mobile LCP window, where it competed with the
  // fonts for bandwidth and cost ~1.9s of simulated LCP.
  lines.push(`  <script>`)
  lines.push(`    ;(function () {`)
  lines.push(`      var id = '${site.gaId}'`)
  lines.push(`      var events = ['pointerdown', 'keydown', 'touchstart', 'scroll']`)
  lines.push(`      var started = false`)
  lines.push(`      function start() {`)
  lines.push(`        if (started) return`)
  lines.push(`        started = true`)
  lines.push(`        events.forEach(function (name) {`)
  lines.push(`          window.removeEventListener(name, start, true)`)
  lines.push(`        })`)
  lines.push(`        var s = document.createElement('script')`)
  lines.push(`        s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id`)
  lines.push(`        s.async = true`)
  lines.push(`        s.onload = function () {`)
  lines.push(`          window.dataLayer = window.dataLayer || []`)
  lines.push(`          function gtag() {`)
  lines.push(`            dataLayer.push(arguments)`)
  lines.push(`          }`)
  lines.push(`          gtag('js', new Date())`)
  lines.push(`          gtag('config', id)`)
  lines.push(`        }`)
  lines.push(`        document.head.appendChild(s)`)
  lines.push(`      }`)
  lines.push(`      events.forEach(function (name) {`)
  lines.push(
    `        window.addEventListener(name, start, { capture: true, passive: true, once: true })`,
  )
  lines.push(`      })`)
  lines.push(`      window.addEventListener('load', function () {`)
  lines.push(`        setTimeout(start, 3000)`)
  lines.push(`      })`)
  lines.push(`    })()`)
  lines.push(`  </script>`)

  if (page.meta.keywords) {
    lines.push(`  <meta name="keywords" content="${page.meta.keywords}" />`)
  }

  if (page.meta.robots) {
    lines.push(`  <meta name="robots" content="${page.meta.robots}" />`)
  }

  // Open Graph
  lines.push(`  <meta property="og:title" content="${page.meta.og.title}" />`)
  lines.push(`  <meta property="og:description" content="${page.meta.og.description}" />`)
  lines.push(`  <meta property="og:type" content="${page.meta.og.type}" />`)
  lines.push(`  <meta property="og:url" content="${page.meta.og.url}" />`)

  if (page.meta.og.siteName) {
    lines.push(`  <meta property="og:site_name" content="${page.meta.og.siteName}" />`)
  }

  if (page.meta.og.image) {
    const img = page.meta.og.image
    lines.push(`  <meta property="og:image" content="${img.url}" />`)
    lines.push(`  <meta property="og:image:secure_url" content="${img.url}" />`)
    lines.push(`  <meta property="og:image:type" content="${img.type}" />`)
    lines.push(`  <meta property="og:image:width" content="${img.width}" />`)
    lines.push(`  <meta property="og:image:height" content="${img.height}" />`)
    lines.push(`  <meta property="og:image:alt" content="${img.alt}" />`)
  }

  // Twitter / X card
  if (page.meta.twitter) {
    const tw = page.meta.twitter
    lines.push(`  <meta name="twitter:card" content="${tw.card}" />`)
    lines.push(`  <meta name="twitter:title" content="${tw.title}" />`)
    lines.push(`  <meta name="twitter:description" content="${tw.description}" />`)
    lines.push(`  <meta name="twitter:image" content="${tw.image}" />`)
    lines.push(`  <meta name="twitter:image:alt" content="${tw.imageAlt}" />`)
  }

  // Shared meta + assets
  lines.push(`  <meta name="theme-color" content="${site.themeColor}" />`)
  lines.push(`  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />`)
  lines.push(`  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />`)
  lines.push(`  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />`)
  lines.push(`  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />`)
  lines.push(`  <link rel="manifest" href="/site.webmanifest" />`)
  lines.push(`  <link rel="canonical" href="${page.meta.canonical}" />`)
  lines.push(
    `  <link rel="preload" href="/fonts/fraunces-latin-700.woff2" as="font" type="font/woff2" crossorigin />`,
  )
  lines.push(
    `  <link rel="preload" href="/fonts/space-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin />`,
  )
  // Escape any accidental </style> sequences so inlining cannot close the tag early.
  const safeCss = stylesCss.replace(/<\/style/gi, '<\\/style')
  lines.push(`  <style>`)
  lines.push(safeCss)
  lines.push(`  </style>`)

  // Optional JSON-LD structured data
  if (page.schemaJson) {
    const indented = JSON.stringify(page.schemaJson, null, 6)
      .split('\n')
      .map((l) => `    ${l}`)
      .join('\n')
    lines.push(`  <script type="application/ld+json">`)
    lines.push(indented)
    lines.push(`  </script>`)
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Build the footer schedule <a> tag from per-page footer config.
// ---------------------------------------------------------------------------
function buildFooterScheduleLink(footer) {
  const targetAttr = footer.scheduleTarget ? ` target="${footer.scheduleTarget}"` : ''
  const relAttr = footer.scheduleRel ? ` rel="${footer.scheduleRel}"` : ''
  return `<a href="${footer.scheduleHref}"${targetAttr}${relAttr}>Schedule</a>`
}

// ---------------------------------------------------------------------------
// Main build
// ---------------------------------------------------------------------------
function injectVersionedResumeLinks(content, resumeUrl) {
  return content.replaceAll('/Resume-David-Dangerfield.pdf', resumeUrl)
}

// ---------------------------------------------------------------------------
// script.js is served with a long Browser Cache TTL, so it needs a
// cache-busting query param that changes whenever its content does. Rather
// than a manually-bumped version (like resumeVersion in site.json), this
// hashes the already-bundled script.js — deterministic, so `npm run build`
// produces the same {{SCRIPT_VERSION}} on every machine/CI run as long as
// the bundled output is unchanged, and it can't be forgotten on a deploy.
// ---------------------------------------------------------------------------
function hashScriptVersion(scriptJs) {
  return createHash('sha256').update(scriptJs).digest('hex').slice(0, 10)
}

async function writeGenerated(outputPath, html, sourceLabel) {
  const generatedComment = [
    `<!-- GENERATED FILE — do not edit directly. -->`,
    `<!-- Source: ${sourceLabel} -->`,
    `<!-- Regenerate: npm run build -->`,
  ].join('\n')

  const fullPath = join(ROOT_DIR, outputPath)
  await mkdir(dirname(fullPath), { recursive: true })
  await writeFile(fullPath, `${generatedComment}\n${html}`, 'utf8')
  console.log(`  ✓ ${outputPath}`)
}

export async function build() {
  const site = JSON.parse(await readFile(join(SRC_DIR, 'site.json'), 'utf8'))
  const stylesCss = await readFile(join(ROOT_DIR, 'styles.css'), 'utf8')
  const layout = await readFile(join(SRC_DIR, 'partials', 'layout.html'), 'utf8')
  const scriptVersion = hashScriptVersion(await readFile(join(ROOT_DIR, 'script.js')))
  const headerPartial = injectVersionedResumeLinks(
    await readFile(join(SRC_DIR, 'partials', 'header.html'), 'utf8'),
    site.resumeUrl,
  )
  const footerPartial = injectVersionedResumeLinks(
    await readFile(join(SRC_DIR, 'partials', 'footer.html'), 'utf8'),
    site.resumeUrl,
  )

  const discovered = await discoverPages(ROOT_DIR)
  const problems = discovered.flatMap((p) => {
    if (p.metaError) return [`${p.pageId}: ${p.metaError}`]
    return missingRequiredFields(p.meta).map(
      (field) => `${p.pageId}: missing required field ${field}`,
    )
  })
  if (problems.length > 0) {
    const details = problems.map((p) => `  - ${p}`).join('\n')
    throw new Error(`Invalid meta.json:\n${details}`)
  }

  const written = []

  for (const { pageId, pageDir, meta: page } of discovered) {
    const pageContent = injectVersionedResumeLinks(
      await readFile(join(pageDir, 'content.html'), 'utf8'),
      site.resumeUrl,
    )

    const headContent = buildHeadContent(page, site, stylesCss)
    const footer = interpolate(footerPartial, {
      FOOTER_SCHEDULE_LINK: buildFooterScheduleLink(page.footer),
    })

    const html = interpolate(layout, {
      HEAD_CONTENT: headContent,
      HEADER: headerPartial,
      PAGE_CONTENT: pageContent,
      FOOTER: footer,
      SCRIPT_VERSION: scriptVersion,
    })

    await writeGenerated(
      page.outputPath,
      html,
      `src/pages/${pageId}/content.html + src/partials/layout.html`,
    )
    written.push(page.outputPath)
  }

  const redirectTemplate = await readFile(join(SRC_DIR, 'partials', 'resume-redirect.html'), 'utf8')
  for (const redirect of RESUME_REDIRECTS) {
    const html = injectVersionedResumeLinks(
      interpolate(redirectTemplate, { CANONICAL_URL: redirect.canonicalUrl }),
      site.resumeUrl,
    )
    await writeGenerated(redirect.outputPath, html, 'src/partials/resume-redirect.html')
    written.push(redirect.outputPath)
  }

  console.log(`\nBuild complete — ${written.length} pages generated.`)
  return { written }
}

// Only run when executed directly (`node scripts/build.mjs`), not when
// imported — dev.mjs imports build() and calls it in-process instead.
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  build().catch((err) => {
    console.error('\nBuild failed:', err.message)
    process.exit(1)
  })
}
