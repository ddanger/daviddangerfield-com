import { test } from 'node:test'
import assert from 'node:assert/strict'
import { html } from './html.mjs'

test('escapes interpolated values', () => {
  const value = `"Tom & Jerry" <b>`
  assert.equal(
    String(html`<meta content="${value}" />`),
    '<meta content="&quot;Tom &amp; Jerry&quot; &lt;b&gt;" />',
  )
})

test('leaves the template text alone', () => {
  assert.equal(String(html`<p class="a">&amp;</p>`), '<p class="a">&amp;</p>')
})

test('nested html fragments are not escaped again', () => {
  const inner = html`<b>${'a & b'}</b>`
  assert.equal(String(html`<p>${inner}</p>`), '<p><b>a &amp; b</b></p>')
})

test('arrays render each item and join without commas', () => {
  const items = ['<x>', html`<i>y</i>`]
  assert.equal(String(html`<p>${items}</p>`), '<p>&lt;x&gt;<i>y</i></p>')
})

test('non-string values are stringified', () => {
  assert.equal(String(html`<img width="${1200}" />`), '<img width="1200" />')
})
