/**
 * Builds dist/ (the published site, never committed) from src/. Pages are
 * auto-discovered: a folder in src/pages/ with content.html and meta.json is a
 * page. Run bundleJs() first: it wipes dist/ and writes the script.js whose
 * hash versions the script URL here.
 */

import { readFile, writeFile, mkdir, cp } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { transform } from 'esbuild'
import { minify as minifyHtml } from 'html-minifier-terser'
import { discoverPages } from './lib/routes.mjs'
import { missingRequiredFields } from './lib/meta-schema.mjs'
import { STATIC_ASSET_PATHS, HOST_CONFIG_FILES } from './lib/static-assets.mjs'
import { renderResumePage } from './lib/resume-html.mjs'
import { html } from './lib/html.mjs'

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

  lines.push(`<meta charset="UTF-8" />`)
  lines.push(`<meta name="viewport" content="width=device-width, initial-scale=1" />`)
  lines.push(html`<title>${page.meta.title}</title>`)
  lines.push(html`<meta name="description" content="${page.meta.description}" />`)

  // No analytics or tracking scripts: see docs/adr/0001-performance-over-user-tracking.md.

  if (page.meta.keywords) {
    lines.push(html`<meta name="keywords" content="${page.meta.keywords}" />`)
  }

  if (page.meta.robots) {
    lines.push(html`<meta name="robots" content="${page.meta.robots}" />`)
  }

  lines.push(html`<meta property="og:title" content="${page.meta.og.title}" />`)
  lines.push(html`<meta property="og:description" content="${page.meta.og.description}" />`)
  lines.push(html`<meta property="og:type" content="${page.meta.og.type}" />`)
  lines.push(html`<meta property="og:url" content="${page.meta.og.url}" />`)

  if (page.meta.og.siteName) {
    lines.push(html`<meta property="og:site_name" content="${page.meta.og.siteName}" />`)
  }

  if (page.meta.og.image) {
    const img = page.meta.og.image
    lines.push(html`<meta property="og:image" content="${img.url}" />`)
    lines.push(html`<meta property="og:image:secure_url" content="${img.url}" />`)
    lines.push(html`<meta property="og:image:type" content="${img.type}" />`)
    lines.push(html`<meta property="og:image:width" content="${img.width}" />`)
    lines.push(html`<meta property="og:image:height" content="${img.height}" />`)
    lines.push(html`<meta property="og:image:alt" content="${img.alt}" />`)
  }

  if (page.meta.twitter) {
    const tw = page.meta.twitter
    lines.push(html`<meta name="twitter:card" content="${tw.card}" />`)
    lines.push(html`<meta name="twitter:title" content="${tw.title}" />`)
    lines.push(html`<meta name="twitter:description" content="${tw.description}" />`)
    lines.push(html`<meta name="twitter:image" content="${tw.image}" />`)
    lines.push(html`<meta name="twitter:image:alt" content="${tw.imageAlt}" />`)
  }

  lines.push(html`<meta name="theme-color" content="${site.themeColor}" />`)
  lines.push(`<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />`)
  lines.push(`<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />`)
  lines.push(`<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />`)
  lines.push(`<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />`)
  lines.push(`<link rel="manifest" href="/site.webmanifest" />`)
  lines.push(html`<link rel="canonical" href="${page.meta.canonical}" />`)
  lines.push(
    `<link rel="preload" href="/fonts/fraunces-latin-700.woff2" as="font" type="font/woff2" crossorigin />`,
  )
  lines.push(
    `<link rel="preload" href="/fonts/space-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin />`,
  )
  // CSS is inlined to avoid a render-blocking request. Escape any </style> in
  // it so the inlined block can't close early.
  const safeCss = stylesCss.replace(/<\/style/gi, '<\\/style')
  lines.push(`<style>`)
  lines.push(safeCss)
  lines.push(`</style>`)

  // Escape < so a string in the data can't close the script element.
  if (page.schemaJson) {
    lines.push(`<script type="application/ld+json">`)
    lines.push(JSON.stringify(page.schemaJson).replaceAll('<', '\\u003c'))
    lines.push(`</script>`)
  }

  return lines.join('\n')
}

function buildFooterScheduleLink(footer) {
  const targetAttr = footer.scheduleTarget ? html` target="${footer.scheduleTarget}"` : ''
  const relAttr = footer.scheduleRel ? html` rel="${footer.scheduleRel}"` : ''
  // Prettier formats html`` as HTML and would put a space before ${targetAttr}.
  // prettier-ignore
  return String(html`<a href="${footer.scheduleHref}"${targetAttr}${relAttr}>Schedule</a>`)
}

// Only links inside <nav>: the brand link also points to /. A section link
// stays current on its subpages (Work on /work/patterson/), Home only on /.
function markCurrentNavLink(header, route) {
  return header.replace(/<nav[\s\S]*?<\/nav>/, (nav) =>
    nav.replace(/<a href="([^"]+)"/g, (tag, href) =>
      href === route || (href !== '/' && route.startsWith(href))
        ? `${tag} aria-current="page"`
        : tag,
    ),
  )
}

// meta.json "renderer": fills {{PLACEHOLDERS}} in a page's content.html with
// HTML generated from data in the page folder.
const PAGE_RENDERERS = {
  resume: renderResumePage,
}

async function readPageContent(pageId, pageDir, renderer) {
  const content = await readFile(join(pageDir, 'content.html'), 'utf8')
  if (!renderer) return content
  if (!PAGE_RENDERERS[renderer]) throw new Error(`${pageId}: unknown renderer "${renderer}"`)
  return interpolate(content, await PAGE_RENDERERS[renderer](pageDir))
}

// script.js is cached as immutable (cloudflare/_headers), so its URL carries a
// hash of its content: deterministic across machines and never forgotten. The
// resume PDF's links are versioned the same way.
function hashVersion(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 10)
}

function injectVersionedResumeLinks(content, resumeUrl) {
  return content.replaceAll('/Resume-David-Dangerfield.pdf', resumeUrl)
}

// Keep the email_off comments: the host's edge reads them (README, Hosting).
const HTML_MINIFY_OPTIONS = {
  collapseWhitespace: true,
  removeComments: true,
  ignoreCustomComments: [/^\/?email_off$/],
  collapseBooleanAttributes: true,
}

async function writeGenerated(outputPath, pageHtml, minify) {
  const fullPath = join(DIST_DIR, outputPath)
  await mkdir(dirname(fullPath), { recursive: true })
  const output = minify ? await minifyHtml(pageHtml, HTML_MINIFY_OPTIONS) : pageHtml
  await writeFile(fullPath, output, 'utf8')
  console.log(`  ✓ dist/${outputPath}`)
}

// dev.mjs passes minify: false so local output stays readable.
export async function build({ minify = true } = {}) {
  await copyStaticAssets()

  const site = JSON.parse(await readFile(join(SRC_DIR, 'site.json'), 'utf8'))
  const prepareCss = async (rawCss) =>
    minify ? (await transform(rawCss, { loader: 'css', minify: true })).code : rawCss
  const stylesCss = await prepareCss(await readFile(join(ROOT_DIR, 'styles.css'), 'utf8'))
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
  const scriptVersion = hashVersion(scriptJs)
  const resumePdf = await readFile(join(ROOT_DIR, 'Resume-David-Dangerfield.pdf'))
  const resumeUrl = `/Resume-David-Dangerfield.pdf?v=${hashVersion(resumePdf)}`
  const headerPartial = injectVersionedResumeLinks(
    await readFile(join(SRC_DIR, 'partials', 'header.html'), 'utf8'),
    resumeUrl,
  )
  const footerPartial = injectVersionedResumeLinks(
    await readFile(join(SRC_DIR, 'partials', 'footer.html'), 'utf8'),
    resumeUrl,
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

  for (const { pageId, pageDir, meta: page, route } of discovered) {
    const pageContent = injectVersionedResumeLinks(
      await readPageContent(pageId, pageDir, page.renderer),
      resumeUrl,
    )

    // Optional meta.json "stylesheet": a CSS file in the page folder, inlined
    // after styles.css on that page only.
    const pageCss = page.stylesheet
      ? await prepareCss(await readFile(join(pageDir, page.stylesheet), 'utf8'))
      : ''
    const headContent = buildHeadContent(page, site, `${stylesCss}\n${pageCss}`)
    const footer = interpolate(footerPartial, {
      FOOTER_SCHEDULE_LINK: buildFooterScheduleLink(page.footer),
    })

    const pageHtml = interpolate(layout, {
      HEAD_CONTENT: headContent,
      HEADER: markCurrentNavLink(headerPartial, route),
      PAGE_CONTENT: pageContent,
      FOOTER: footer,
      SCRIPT_VERSION: scriptVersion,
    })

    await writeGenerated(page.outputPath, pageHtml, minify)
    written.push(page.outputPath)
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
