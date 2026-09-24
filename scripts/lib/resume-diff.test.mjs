import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffResumes } from './resume-diff.mjs'

const base = {
  name: 'Ada',
  headline: ['Engineer'],
  industries: ['Math'],
  contact: { location: 'London', links: [] },
  summary: 'Wrote programs.',
  availability: 'Available.',
  skills: [
    { id: 'languages', label: 'Languages', items: ['Notes', 'Tables'] },
    { id: 'tools', label: 'Tools', items: ['Engine'] },
  ],
  jobs: [
    {
      id: 'engine',
      title: 'Analyst',
      employer: 'Babbage',
      location: 'London',
      start: '1842-01',
      end: '1843-01',
      bullets: [
        { id: 'engine-a', lead: 'Wrote', text: 'Wrote Note G' },
        { id: 'engine-b', lead: 'Translated', text: 'Translated a paper' },
      ],
      tech: ['Cards'],
    },
  ],
  education: [{ degree: 'Tutoring', school: 'Home', location: 'London', year: 1830 }],
}

const copy = () => structuredClone(base)

test('no changes', () => {
  const diff = diffResumes(base, copy())
  assert.equal(diff.changes, 'No changes from the canonical resume.')
  assert.equal(diff.newCount, 0)
})

test('selecting and ordering existing content adds nothing to fact-check', () => {
  const variant = copy()
  variant.jobs[0].bullets.reverse()
  variant.skills.reverse()
  variant.jobs[0].bullets.pop()
  const diff = diffResumes(base, variant)
  assert.equal(diff.newCount, 0)
  assert.match(diff.changes, /removed bullet engine-a/)
  assert.match(diff.changes, /groups reordered: tools, languages/)
})

test('reworded, new, and added content is listed for fact-checking', () => {
  const variant = copy()
  variant.summary = 'Wrote the first program.'
  variant.jobs[0].bullets[0].text = 'Wrote Note G, the first program'
  variant.jobs[0].bullets.push({ id: 'engine-c', lead: 'Built', text: 'Built a compiler' })
  variant.skills[1].items.push('Loom')
  variant.jobs[0].title = 'Lead Analyst'
  const { newText, newCount, changes } = diffResumes(base, variant)
  assert.equal(newCount, 5)
  assert.match(newText, /summary: Wrote the first program\./)
  assert.match(newText, /bullet engine-a: Wrote Note G, the first program/)
  assert.match(newText, /bullet engine-c: Built a compiler/)
  assert.match(newText, /Tools: added Loom/)
  assert.match(newText, /engine title: Lead Analyst/)
  assert.match(changes, /- was: Wrote programs\.\n {2}- now: Wrote the first program\./)
})
