import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { discoverPages } from './lib/routes.mjs'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(SCRIPTS_DIR, '..')

async function generatedFiles() {
  const pages = await discoverPages(ROOT_DIR)
  const broken = pages.filter((p) => p.metaError)
  if (broken.length > 0) {
    // build.mjs (invoked below) will throw with the same detail — bail early
    // rather than produce a confusing empty-list diff check.
    console.error(`Invalid meta.json for ${broken.length} page(s); run: npm run build`)
    process.exit(1)
  }
  return pages.map((p) => p.meta.outputPath)
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const files = await generatedFiles()

run('npm', ['run', 'build'])

const check = spawnSync('git', ['diff', '--exit-code', '--', ...files], {
  cwd: ROOT_DIR,
  stdio: 'inherit',
})

if (check.status !== 0) {
  console.error('\nGenerated HTML files are out of date. Run: npm run build')
  process.exit(1)
}

console.log('\nGenerated HTML files are in sync.')
