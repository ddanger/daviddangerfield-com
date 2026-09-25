// Single quotes aren't escaped: attributes built with this must use double
// quotes.
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

class SafeHtml {
  constructor(value) {
    this.value = value
  }

  toString() {
    return this.value
  }
}

function render(value) {
  if (value instanceof SafeHtml) return value.value
  if (Array.isArray(value)) return value.map(render).join('')
  return String(value).replace(/[&<>"]/g, (char) => ENTITIES[char])
}

// Tagged template: every interpolated value is escaped unless it came from
// another html`` call, so fragments compose without double-escaping.
export function html(strings, ...values) {
  return new SafeHtml(strings.reduce((out, string, i) => out + render(values[i - 1]) + string))
}
