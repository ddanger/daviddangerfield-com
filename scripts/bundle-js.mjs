/**
 * BUILD-TIME ONLY — bundles src/client into a single script.js for the browser.
 *
 * Usage: node scripts/bundle-js.mjs — or import { bundleJs } from './bundle-js.mjs'
 */

import * as esbuild from 'esbuild'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(SCRIPTS_DIR, '..')

export async function bundleJs() {
  await esbuild.build({
    entryPoints: [join(ROOT_DIR, 'src', 'client', 'entry.js')],
    bundle: true,
    outfile: join(ROOT_DIR, 'script.js'),
    format: 'esm',
    target: ['es2020'],
    minify: true,
    banner: {
      js: '/* GENERATED FILE — do not edit. Source: src/client/. Regenerate: npm run build:js */',
    },
  })
  console.log('  ✓ script.js')
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  bundleJs().catch((err) => {
    console.error('\nJS bundle failed:', err.message)
    process.exit(1)
  })
}
