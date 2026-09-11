// The contract every src/pages/{page}/meta.json must satisfy to render a
// full <head> via buildHeadContent (scripts/build.mjs). Both build.mjs
// (fail-fast at build time) and validate-source.mjs (CI check) enforce it
// from this one list, so they can't drift apart.
export const REQUIRED_META_FIELDS = [
  'meta.title',
  'meta.description',
  'meta.canonical',
  'meta.og.title',
  'meta.og.description',
  'meta.og.type',
  'meta.og.url',
]

export function getByPath(obj, dottedPath) {
  return dottedPath.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj)
}

// Returns the dotted paths of any required fields missing (or non-string)
// from `meta` (a parsed meta.json). Empty array means valid.
export function missingRequiredFields(meta) {
  return REQUIRED_META_FIELDS.filter((field) => {
    const value = getByPath(meta, field)
    return !value || typeof value !== 'string'
  })
}
