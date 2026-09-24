import { readdir, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { extname, join, relative } from 'node:path'

export const RESUME_PDF = 'Resume-David-Dangerfield.pdf'
export const RESUME_ROUTE = '/resume/'

// Everything the printed PDF is made from. styles.css is left out on purpose:
// resume.css overrides what the sheet uses from it, and including it would
// demand a PDF rebuild for every site style change.
const SOURCE_DIRS = ['src/pages/resume', 'fonts/resume']

const BINARY_EXTENSIONS = new Set(['.woff2'])

// A hash of the resume source, recorded in src/site.json when the PDF is
// built. validate-source compares it so the committed PDF can't fall behind
// the page. Line endings are normalized so a checkout's autocrlf can't change
// it.
export async function hashResumeSource(rootDir) {
  const files = []
  for (const dir of SOURCE_DIRS) {
    const entries = await readdir(join(rootDir, dir), { recursive: true, withFileTypes: true })
    for (const entry of entries) {
      // Dotfiles (.DS_Store) aren't committed, so they'd make local and CI
      // hashes disagree.
      if (entry.isFile() && !entry.name.startsWith('.')) {
        files.push(join(entry.parentPath, entry.name))
      }
    }
  }

  const hash = createHash('sha256')
  for (const file of files.map((f) => relative(rootDir, f).split('\\').join('/')).sort()) {
    const content = await readFile(join(rootDir, file))
    hash.update(`${file}\n`)
    hash.update(
      BINARY_EXTENSIONS.has(extname(file))
        ? content
        : content.toString('utf8').replaceAll('\r\n', '\n'),
    )
  }
  return hash.digest('hex').slice(0, 16)
}
