import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { discoverPages } from './lib/routes.mjs'
import { missingRequiredFields } from './lib/meta-schema.mjs'
import { listGeneratedFiles } from './lib/generated-files.mjs'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(SCRIPTS_DIR, '..')

async function generatedFiles() {
  const pages = await discoverPages(ROOT_DIR)
  const problems = pages.flatMap((p) => {
    if (p.metaError) return [`${p.pageId}: ${p.metaError}`]
    return missingRequiredFields(p.meta).map(
      (field) => `${p.pageId}: missing required field ${field}`,
    )
  })
  if (problems.length > 0) {
    // build.mjs (invoked below) will throw with the same detail — bail early
    // rather than produce a confusing empty-list diff check.
    console.error(`Invalid meta.json:\n${problems.map((p) => `  - ${p}`).join('\n')}`)
    process.exit(1)
  }
  return listGeneratedFiles(ROOT_DIR)
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
