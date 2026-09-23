// Files copied unchanged into dist/ (directories recursively). Deliberately
// absent: headshot-*.jpg at the root (unoptimized originals; images/headshots/
// has the served sizes) and styles.css (inlined by build.mjs, never served).
export const STATIC_ASSET_PATHS = [
  'apple-touch-icon.png',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'favicon-48x48.png',
  'favicon.png',
  'favicon.svg',
  'icon-192.png',
  'icon-512.png',
  'site.webmanifest',
  'robots.txt',
  'sitemap.xml',
  'Resume-David-Dangerfield.pdf',
  'fonts',
  'images',
]

// Host config, published at the root under the names the host requires. All
// provider-specific config lives in a folder named for the provider (README,
// Hosting).
export const HOST_CONFIG_FILES = [
  { from: 'cloudflare/_headers', to: '_headers' },
  { from: 'cloudflare/_redirects', to: '_redirects' },
]
