/**
 * Builds dist/ (the published site, never committed) from src/. Pages are
 * auto-discovered: a folder in src/pages/ with content.html and meta.json is a
 * page. The /resume/ and /cv/ redirects are the exception (see
 * scripts/lib/resume-redirects.mjs). Run bundleJs() first: it wipes dist/ and
 * writes the script.js whose hash versions the script URL here.
 */

import { readFile, writeFile, mkdir, cp } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { transform } from 'esbuild'
import { minify as minifyHtml } from 'html-minifier-terser'
import { discoverPages } from './lib/routes.mjs'
import { missingRequiredFields } from './lib/meta-schema.mjs'
import { RESUME_REDIRECTS } from './lib/resume-redirects.mjs'
import { STATIC_ASSET_PATHS, HOST_CONFIG_FILES } from './lib/static-assets.mjs'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(SCRIPTS_DIR, '..')
const SRC_DIR = join(ROOT_DIR, 'src')
const DIST_DIR = join(ROOT_DIR, 'dist')

async function copyStaticAssets() {
  await mkdir(DIST_DIR, { recursive: true })
  for (const relPath of STATIC_ASSET_PATHS) {
    await cp(join(ROOT_DIR, relPath), join(DIST_DIR, relPath), { recursive: true })
  }
  for (const { from, to } of HOST_CONFIG_FILES) {
    await cp(join(ROOT_DIR, from), join(DIST_DIR, to), { recursive: true })
  }
  console.log(
    `  ✓ ${STATIC_ASSET_PATHS.length} static assets, ${HOST_CONFIG_FILES.length} host config files`,
  )
}

function interpolate(template, vars) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => {
    if (key in vars) return vars[key]
    throw new Error(`Unknown template variable: {{${key}}}`)
  })
}

function buildHeadContent(page, site, stylesCss) {
  const lines = []

  lines.push(`  <meta charset="UTF-8" />`)
  lines.push(`  <meta name="viewport" content="width=device-width, initial-scale=1" />`)
  lines.push(`  <title>${page.meta.title}</title>`)
  lines.push(`  <meta name="description" content="${page.meta.description}" />`)

  // No analytics or tracking scripts: see docs/adr/0001-performance-over-user-tracking.md.

  if (page.meta.keywords) {
    lines.push(`  <meta name="keywords" content="${page.meta.keywords}" />`)
  }

  if (page.meta.robots) {
    lines.push(`  <meta name="robots" content="${page.meta.robots}" />`)
  }

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

  if (page.meta.twitter) {
    const tw = page.meta.twitter
    lines.push(`  <meta name="twitter:card" content="${tw.card}" />`)
    lines.push(`  <meta name="twitter:title" content="${tw.title}" />`)
    lines.push(`  <meta name="twitter:description" content="${tw.description}" />`)
    lines.push(`  <meta name="twitter:image" content="${tw.image}" />`)
    lines.push(`  <meta name="twitter:image:alt" content="${tw.imageAlt}" />`)
  }

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
  // CSS is inlined to avoid a render-blocking request. Escape any </style> in
  // it so the inlined block can't close early.
  const safeCss = stylesCss.replace(/<\/style/gi, '<\\/style')
  lines.push(`  <style>`)
  lines.push(safeCss)
  lines.push(`  </style>`)

  if (page.schemaJson) {
    lines.push(`  <script type="application/ld+json">`)
    lines.push(JSON.stringify(page.schemaJson))
    lines.push(`  </script>`)
  }

  return lines.join('\n')
}

function buildFooterScheduleLink(footer) {
  const targetAttr = footer.scheduleTarget ? ` target="${footer.scheduleTarget}"` : ''
  const relAttr = footer.scheduleRel ? ` rel="${footer.scheduleRel}"` : ''
  return `<a href="${footer.scheduleHref}"${targetAttr}${relAttr}>Schedule</a>`
}

function injectVersionedResumeLinks(content, resumeUrl) {
  return content.replaceAll('/Resume-David-Dangerfield.pdf', resumeUrl)
}

// script.js is cached as immutable (cloudflare/_headers), so its URL carries a
// hash of its content: deterministic across machines and never forgotten.
function hashScriptVersion(scriptJs) {
  return createHash('sha256').update(scriptJs).digest('hex').slice(0, 10)
}

// Keep the email_off comments: the host's edge reads them (README, Hosting).
const HTML_MINIFY_OPTIONS = {
  collapseWhitespace: true,
  removeComments: true,
  ignoreCustomComments: [/^\/?email_off$/],
  collapseBooleanAttributes: true,
}

async function writeGenerated(outputPath, html, minify) {
  const fullPath = join(DIST_DIR, outputPath)
  await mkdir(dirname(fullPath), { recursive: true })
  const output = minify ? await minifyHtml(html, HTML_MINIFY_OPTIONS) : html
  await writeFile(fullPath, output, 'utf8')
  console.log(`  ✓ dist/${outputPath}`)
}

// dev.mjs passes minify: false so local output stays readable.
export async function build({ minify = true } = {}) {
  await copyStaticAssets()

  const site = JSON.parse(await readFile(join(SRC_DIR, 'site.json'), 'utf8'))
  const rawCss = await readFile(join(ROOT_DIR, 'styles.css'), 'utf8')
  const stylesCss = minify
    ? (await transform(rawCss, { loader: 'css', minify: true })).code
    : rawCss
  const layout = await readFile(join(SRC_DIR, 'partials', 'layout.html'), 'utf8')
  const scriptJs = await readFile(join(DIST_DIR, 'script.js')).catch((err) => {
    if (err.code === 'ENOENT') {
      throw new Error(
        'dist/script.js not found. Run `npm run build:js` (or `npm run build`) first. ' +
          'build.mjs hashes the bundled script.js for cache-busting and assumes it already exists.',
      )
    }
    throw err
  })
  const scriptVersion = hashScriptVersion(scriptJs)
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

    await writeGenerated(page.outputPath, html, minify)
    written.push(page.outputPath)
  }

  const redirectTemplate = await readFile(join(SRC_DIR, 'partials', 'resume-redirect.html'), 'utf8')
  for (const redirect of RESUME_REDIRECTS) {
    const html = injectVersionedResumeLinks(
      interpolate(redirectTemplate, { CANONICAL_URL: redirect.canonicalUrl }),
      site.resumeUrl,
    )
    await writeGenerated(redirect.outputPath, html, minify)
    written.push(redirect.outputPath)
  }

  console.log(`\nBuild complete: ${written.length} pages generated.`)
  return { written }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  build().catch((err) => {
    console.error('\nBuild failed:', err.message)
    process.exit(1)
  })
}
