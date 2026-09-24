import { readFile } from 'node:fs/promises'
import { getDocumentProxy } from 'unpdf'
import { openDistPage } from './resume-browser.mjs'
import { RESUME_ROUTE } from './resume-source.mjs'

export const EXPECTED_PAGES = 2

// Words as a reader or ATS parser sees them. Bullet glyphs come from CSS, so
// only the PDF has them. A line break after a hyphen splits a word in PDF
// text but not in the page's.
function words(text) {
  return text
    .replaceAll('●', ' ')
    .replace(/(\S-)\s+/g, '$1')
    .split(/\s+/)
    .filter(Boolean)
}

// Text in content-stream order, the order a parser reads. pdf.js doesn't
// always mark line ends, so a change in baseline also counts as a break.
async function pdfText(pdf) {
  const parts = []
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const { items } = await (await pdf.getPage(n)).getTextContent()
    let baseline
    for (const item of items) {
      const y = item.transform[5]
      if (baseline !== undefined && Math.abs(y - baseline) > 1) parts.push(' ')
      parts.push(item.str, item.hasEOL ? ' ' : '')
      baseline = y
    }
    parts.push(' ')
  }
  return parts.join('')
}

function firstDifference(expected, actual) {
  const length = Math.max(expected.length, actual.length)
  for (let i = 0; i < length; i += 1) {
    if (expected[i] !== actual[i]) {
      const context = (list) => list.slice(Math.max(0, i - 4), i + 5).join(' ')
      return `page: "${context(expected)}"\n    PDF:  "${context(actual)}"`
    }
  }
  return null
}

// Prints dist/resume/ with the page's own print CSS, so this PDF and a
// visitor's Print > Save as PDF come from the same rules. Throws, leaving
// outputPath for inspection, if the result isn't something to send.
export async function printResumePdf(browser, distDir, outputPath) {
  const page = await openDistPage(browser, distDir, RESUME_ROUTE)
  await page.emulateMedia({ media: 'print' })
  const pageText = await page.locator('.resume').innerText()
  await page.pdf({ path: outputPath, preferCSSPageSize: true, printBackground: true, tagged: true })
  await page.close()

  const bytes = await readFile(outputPath)
  const pdf = await getDocumentProxy(new Uint8Array(bytes))
  const problems = []

  if (pdf.numPages !== EXPECTED_PAGES) {
    problems.push(
      `${pdf.numPages} pages, expected ${EXPECTED_PAGES}. Tighten the content or the spacing tokens in src/pages/resume/resume.css.`,
    )
  }

  // Chrome embeds variable fonts as Type 3, which ATS parsers misread. Font
  // dictionaries are uncompressed in Chrome's output, so a byte search works.
  if (/\/Subtype\s*\/Type3/.test(bytes.toString('latin1'))) {
    problems.push('a font is embedded as Type 3. Use static fonts (see resume.css).')
  }

  const difference = firstDifference(words(pageText), words(await pdfText(pdf)))
  if (difference) {
    problems.push(`the PDF's extracted text doesn't match the page:\n    ${difference}`)
  }

  if (problems.length > 0) {
    throw new Error(`${outputPath} failed checks:\n  - ${problems.join('\n  - ')}`)
  }
  return { pages: pdf.numPages }
}
