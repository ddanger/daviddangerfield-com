import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverPages, publicRoutes, outputPathToRoute, isIndexable } from './routes.mjs'

async function withFixtureRoot(pages, fn) {
  const root = await mkdtemp(join(tmpdir(), 'routes-test-'))
  try {
    for (const [pageId, { meta, content = '<p>content</p>' }] of Object.entries(pages)) {
      const pageDir = join(root, 'src', 'pages', pageId)
      await mkdir(pageDir, { recursive: true })
      if (meta !== undefined) {
        await writeFile(join(pageDir, 'meta.json'), meta, 'utf8')
      }
      await writeFile(join(pageDir, 'content.html'), content, 'utf8')
    }
    await fn(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test('outputPathToRoute', () => {
  assert.equal(outputPathToRoute('index.html'), '/')
  assert.equal(outputPathToRoute('about/index.html'), '/about/')
  assert.equal(outputPathToRoute('resume/index.html'), '/resume/')
})

test('isIndexable', () => {
  assert.equal(isIndexable({}), true)
  assert.equal(isIndexable({ meta: { robots: 'noindex, nofollow' } }), false)
  assert.equal(isIndexable({ meta: { robots: 'index, follow' } }), true)
})

test('discoverPages reads every src/pages subdirectory, sorted', async () => {
  await withFixtureRoot(
    {
      services: { meta: JSON.stringify({ outputPath: 'services/index.html' }) },
      about: { meta: JSON.stringify({ outputPath: 'about/index.html' }) },
    },
    async (root) => {
      const pages = await discoverPages(root)
      assert.deepEqual(
        pages.map((p) => p.pageId),
        ['about', 'services'],
      )
      assert.equal(pages[0].route, '/about/')
      assert.equal(pages[0].metaError, null)
    },
  )
})

test('discoverPages captures a parse error without throwing', async () => {
  await withFixtureRoot(
    {
      broken: { meta: '{ not valid json' },
    },
    async (root) => {
      const pages = await discoverPages(root)
      assert.equal(pages.length, 1)
      assert.equal(pages[0].meta, null)
      assert.equal(typeof pages[0].metaError, 'string')
      assert.equal(pages[0].route, null)
    },
  )
})

test('publicRoutes keeps only indexable, trailing-slash, non-helper routes', () => {
  const pages = [
    { route: '/about/', metaError: null, indexable: true },
    { route: '/private/', metaError: null, indexable: false }, // noindex
    { route: '/resume/', metaError: null, indexable: true }, // helper route
    { route: '/broken', metaError: 'bad json', indexable: true },
    { route: '/legacy.html', metaError: null, indexable: true }, // no trailing slash
  ]

  assert.deepEqual(
    publicRoutes(pages).map((p) => p.route),
    ['/about/'],
  )
})
