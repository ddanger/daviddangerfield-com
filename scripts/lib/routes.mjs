import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(SCRIPTS_DIR, '..', '..')
const PAGES_DIR = join(ROOT_DIR, 'src', 'pages')

export const HELPER_ROUTES = new Set(['/schedule/', '/cv/', '/resume/'])

export function outputPathToRoute(outputPath) {
  if (outputPath === 'index.html') return '/'
  if (outputPath.endsWith('/index.html')) {
    return `/${outputPath.slice(0, -'index.html'.length)}`
  }
  return `/${outputPath}`
}

export function isIndexable(meta) {
  const robots = String(meta?.meta?.robots || '').toLowerCase()
  return !robots.includes('noindex')
}

// A "public route" is one build.mjs generates, that carries a real page
// (trailing-slash route, not a helper page with no src/pages source), and
// that's meant to be listed (not marked noindex). generate-sitemap.mjs and
// uptime-check.mjs both want exactly this set.
export function publicRoutes(pages) {
  return pages.filter(
    (page) =>
      !page.metaError &&
      page.route &&
      page.indexable &&
      page.route.endsWith('/') &&
      !HELPER_ROUTES.has(page.route),
  )
}

export async function discoverPages(rootDir = ROOT_DIR) {
  const pagesDir = join(rootDir, 'src', 'pages')
  const entries = await readdir(pagesDir, { withFileTypes: true })
  const pageIds = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  const pages = []
  for (const pageId of pageIds) {
    const pageDir = join(pagesDir, pageId)
    const metaPath = join(pageDir, 'meta.json')
    const contentPath = join(pageDir, 'content.html')

    let meta = null
    let metaError = null
    let route = null

    try {
      meta = JSON.parse(await readFile(metaPath, 'utf8'))
      if (typeof meta?.outputPath === 'string' && meta.outputPath.length > 0) {
        route = outputPathToRoute(meta.outputPath)
      }
    } catch (err) {
      metaError = err instanceof Error ? err.message : String(err)
    }

    pages.push({
      pageId,
      pageDir,
      metaPath,
      contentPath,
      meta,
      metaError,
      route,
      indexable: meta ? isIndexable(meta) : false,
    })
  }

  return pages
}

export { ROOT_DIR, PAGES_DIR }
