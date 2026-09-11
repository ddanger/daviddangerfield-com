import { discoverPages, ROOT_DIR } from './routes.mjs'
import { RESUME_REDIRECTS } from './resume-redirects.mjs'

// Every file build.mjs writes — the pages from src/pages plus the fixed
// resume/cv redirect pages. The one place that answers "what did the build
// produce," so verify-generated.mjs and the generated-output-sync workflow
// can't drift out of step with each other or with build.mjs itself.
export async function listGeneratedFiles(rootDir = ROOT_DIR) {
  const pages = await discoverPages(rootDir)
  return [...pages.map((p) => p.meta.outputPath), ...RESUME_REDIRECTS.map((r) => r.outputPath)]
}
