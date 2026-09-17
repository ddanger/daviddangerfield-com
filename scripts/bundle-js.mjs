/**
 * BUILD-TIME ONLY — bundles src/client into a single script.js for the browser.
 *
 * Usage: node scripts/bundle-js.mjs — or import { bundleJs } from './bundle-js.mjs'
 */

import * as esbuild from 'esbuild'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(SCRIPTS_DIR, '..')
const DIST_DIR = join(ROOT_DIR, 'dist')

export async function bundleJs() {
  // dist/ is the whole published site and is never committed. Wiped here
  // because this always runs first — see
  // package.json's `build` script and dev.mjs's runBuild() — so a file
  // removed from src/pages or static-assets.mjs doesn't linger in a stale
  // deploy, and build.mjs (which runs after) just adds to a clean dist/.
  await rm(DIST_DIR, { recursive: true, force: true })
  await mkdir(DIST_DIR, { recursive: true })
  await esbuild.build({
    entryPoints: [join(ROOT_DIR, 'src', 'client', 'entry.js')],
    bundle: true,
    outfile: join(DIST_DIR, 'script.js'),
    format: 'esm',
    target: ['es2020'],
    minify: true,
    banner: {
      js: '/* GENERATED FILE — do not edit. Source: src/client/. Regenerate: npm run build:js */',
    },
  })
  console.log('  ✓ dist/script.js')
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  bundleJs().catch((err) => {
    console.error('\nJS bundle failed:', err.message)
    process.exit(1)
  })
}
