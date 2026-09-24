import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { formatMonth, renderResume } from './resume-html.mjs'
import { ROOT_DIR } from './routes.mjs'

function resume(overrides = {}) {
  return {
    name: 'Ada Lovelace',
    headline: ['Engineer', 'Full-Stack'],
    industries: ['Math'],
    contact: { location: 'London', links: [{ label: 'example.com', url: 'https://example.com' }] },
    summary: 'Wrote the first program.',
    availability: 'Available now.',
    skills: [{ id: 'languages', label: 'Languages', items: ['Notes', 'Tables'] }],
    jobs: [
      {
        id: 'engine',
        title: 'Analyst',
        engagement: 'Contractor',
        employer: 'Babbage & Co',
        employerNote: 'now Engines Ltd',
        location: 'Remote',
        start: '1842-01',
        bullets: [
          {
            id: 'engine-notes',
            lead: 'Wrote Note G',
            text: 'Wrote Note G, a self-running program',
          },
        ],
        tech: ['Analytical Engine'],
      },
    ],
    education: [{ degree: 'Tutoring', school: 'Home', location: 'London', year: 1830 }],
    ...overrides,
  }
}

test('formatMonth', () => {
  assert.equal(formatMonth('2025-03', 'x'), 'Mar 2025')
  assert.throws(() => formatMonth('2025-13', 'job a start'), /job a start: "2025-13"/)
  assert.throws(() => formatMonth('March 2025', 'x'), /YYYY-MM/)
})

test('renders a job: engagement, employer note, open-ended dates, bold lead', () => {
  const html = renderResume(resume())
  assert.match(html, /<h3 class="resume-role">Analyst \(Contractor\)<\/h3>/)
  assert.match(html, /Babbage &amp; Co \(now Engines Ltd\) \(Remote\)/)
  assert.match(html, /Jan 1842 - Present/)
  assert.match(html, /<li><strong>Wrote Note G<\/strong>, a/)
})

test('keeps hyphenated words whole, like Google Docs', () => {
  const html = renderResume(resume())
  assert.match(html, /<span class="resume-nowrap">Full-Stack<\/span>/)
  assert.match(html, /<span class="resume-nowrap">self-running<\/span>/)
  assert.doesNotMatch(html, /1842<\/span>/, 'date ranges have spaced hyphens and stay breakable')
})

test('escapes text', () => {
  const html = renderResume(resume({ summary: '<script>' }))
  assert.match(html, /&lt;script&gt;/)
})

test('rejects a lead that is not the start of its bullet', () => {
  const job = resume().jobs[0]
  const bad = { ...job, bullets: [{ id: 'b', lead: 'Led', text: 'Built it' }] }
  assert.throws(() => renderResume(resume({ jobs: [bad] })), /bullet b: lead "Led"/)
})

test('rejects duplicate ids', () => {
  const job = resume().jobs[0]
  assert.throws(() => renderResume(resume({ jobs: [job, job] })), /duplicate id "engine"/)
})

test('the real resume data renders', async () => {
  const data = JSON.parse(await readFile(`${ROOT_DIR}/src/pages/resume/resume.json`, 'utf8'))
  assert.match(renderResume(data), /<article class="resume">/)
})
