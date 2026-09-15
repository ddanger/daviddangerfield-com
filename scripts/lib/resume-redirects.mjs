// The two bare "click here to download the PDF" pages. They intentionally
// don't go through layout.html (no shared header/nav/footer) — they're just
// a meta-refresh to the versioned resume URL — so they're generated from
// their own small template (src/partials/resume-redirect.html) rather than
// the normal src/pages/{page}/{meta.json,content.html} pipeline.
export const RESUME_REDIRECTS = [
  { outputPath: 'resume/index.html', canonicalUrl: 'https://daviddangerfield.com/resume' },
  { outputPath: 'cv/index.html', canonicalUrl: 'https://daviddangerfield.com/cv' },
]
