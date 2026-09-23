// Required meta.json fields. build.mjs and validate-source.mjs both enforce
// this list.
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

export function missingRequiredFields(meta) {
  return REQUIRED_META_FIELDS.filter((field) => {
    const value = getByPath(meta, field)
    return !value || typeof value !== 'string'
  })
}
