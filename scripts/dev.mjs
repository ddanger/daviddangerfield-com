import { createServer } from 'node:http'
import { access, readFile, stat } from 'node:fs/promises'
import { watch } from 'node:fs'
import { dirname, extname, join, normalize, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build as buildSite } from './build.mjs'
import { bundleJs } from './bundle-js.mjs'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(SCRIPTS_DIR, '..')
const PORT = Number(process.env.PORT || 8000)

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.woff2', 'font/woff2'],
  ['.xml', 'application/xml; charset=utf-8'],
])

let buildQueued = false
let buildRunning = false
let rebuildTimer

function isInsideRoot(pathname) {
  const relativePath = relative(ROOT_DIR, pathname)
  return relativePath === '' || (!relativePath.startsWith('..') && !relativePath.startsWith('/'))
}

async function fileExists(pathname) {
  try {
    await access(pathname)
    return true
  } catch {
    return false
  }
}

async function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl, `http://localhost:${PORT}`)
  const decodedPath = decodeURIComponent(url.pathname)
  const requestedPath = normalize(join(ROOT_DIR, decodedPath))

  if (!isInsideRoot(requestedPath)) return null

  const requestedStat = await stat(requestedPath).catch(() => null)

  if (requestedStat?.isDirectory()) {
    return join(requestedPath, 'index.html')
  }

  if (requestedStat?.isFile()) {
    return requestedPath
  }

  const indexPath = join(requestedPath, 'index.html')
  if (await fileExists(indexPath)) return indexPath

  return null
}

// Calls build helpers in-process rather than shelling out to `npm run build` —
// faster rebuild-on-save, and skips the prettier format pass (dev output is
// transient, never committed, so unformatted is fine).
async function runBuild(reason = 'initial') {
  if (buildRunning) {
    buildQueued = true
    return
  }

  buildRunning = true
  console.log(`\n[dev] Build started (${reason})`)

  try {
    await bundleJs()
    await buildSite()
    console.log('[dev] Build finished')
  } catch (err) {
    console.log(`[dev] Build failed: ${err.message}`)
  } finally {
    buildRunning = false
    if (buildQueued) {
      buildQueued = false
      runBuild('queued change')
    }
  }
}

function queueBuild(filename) {
  clearTimeout(rebuildTimer)
  rebuildTimer = setTimeout(() => runBuild(filename || 'file change'), 150)
}

function startWatcher() {
  watch(join(ROOT_DIR, 'src'), { recursive: true }, (_eventType, filename) => {
    queueBuild(filename)
  })
  watch(join(ROOT_DIR, 'styles.css'), (_eventType, filename) => {
    queueBuild(filename || 'styles.css')
  })
}

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const filePath = await resolveRequestPath(req.url || '/')

      if (!filePath) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('Not found')
        return
      }

      const content = await readFile(filePath)
      res.writeHead(200, {
        'content-type': contentTypes.get(extname(filePath)) || 'application/octet-stream',
      })
      res.end(content)
    } catch (err) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      res.end(`Internal server error\n${err.message}`)
    }
  })

  server.listen(PORT, () => {
    console.log(`[dev] Serving http://localhost:${PORT}`)
    console.log('[dev] Watching src/ and styles.css; rebuilding on changes')
  })
}

runBuild()
startWatcher()
startServer()
