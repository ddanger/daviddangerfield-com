// /resume/ and /cv/: meta-refresh pages to the versioned PDF, with their own
// share preview. They use src/partials/resume-redirect.html, not layout.html.
export const RESUME_REDIRECTS = [
  { outputPath: 'resume/index.html', canonicalUrl: 'https://daviddangerfield.com/resume' },
  { outputPath: 'cv/index.html', canonicalUrl: 'https://daviddangerfield.com/cv' },
]
