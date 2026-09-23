import * as esbuild from 'esbuild'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(SCRIPTS_DIR, '..')
const DIST_DIR = join(ROOT_DIR, 'dist')

export async function bundleJs({ minify = true } = {}) {
  // Every build runs this first (package.json, dev.mjs), so it wipes dist/:
  // files removed from src/ must not linger in a deploy.
  await rm(DIST_DIR, { recursive: true, force: true })
  await mkdir(DIST_DIR, { recursive: true })
  await esbuild.build({
    entryPoints: [join(ROOT_DIR, 'src', 'client', 'entry.js')],
    bundle: true,
    outfile: join(DIST_DIR, 'script.js'),
    format: 'esm',
    target: ['es2020'],
    minify,
  })
  console.log('  ✓ dist/script.js')
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  bundleJs().catch((err) => {
    console.error('\nJS bundle failed:', err.message)
    process.exit(1)
  })
}
