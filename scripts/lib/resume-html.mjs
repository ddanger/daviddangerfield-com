import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Renders resume data (src/pages/resume/resume.json, shaped by
// resume.schema.json) to the <article class="resume"> that resume.css styles
// and update:resume prints. Keep it a pure function of the data, so a variant
// is just different data through the same template.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SEPARATOR = '&nbsp; |&nbsp; '
const WIDE_SEPARATOR = '&nbsp;&nbsp; |&nbsp;&nbsp; '

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

// Google Docs never breaks a line at a hyphen and Chrome does, so hyphenated
// words are kept whole to match the layout resume.css was measured from.
function text(value) {
  return escapeHtml(value).replace(/\S+-\S+/g, '<span class="resume-nowrap">$&</span>')
}

export function formatMonth(value, where) {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '')
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) {
    throw new Error(`${where}: "${value}" isn't a YYYY-MM month`)
  }
  return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`
}

function renderBullet(bullet) {
  if (!bullet.text.startsWith(bullet.lead)) {
    throw new Error(`bullet ${bullet.id}: lead "${bullet.lead}" isn't the start of its text`)
  }
  return `<li><strong>${text(bullet.lead)}</strong>${text(bullet.text.slice(bullet.lead.length))}</li>`
}

function renderJob(job) {
  const title = job.engagement ? `${job.title} (${job.engagement})` : job.title
  const employer = job.employerNote ? `${job.employer} (${job.employerNote})` : job.employer
  const start = formatMonth(job.start, `job ${job.id} start`)
  const end = job.end ? formatMonth(job.end, `job ${job.id} end`) : 'Present'
  return `<section class="resume-job">
  <div class="resume-job-header">
    <h3 class="resume-role">${text(title)}</h3>
    <p class="resume-dates">${start} - ${end}</p>
  </div>
  <p class="resume-company">${text(`${employer} (${job.location})`)}</p>
  <ul class="resume-bullets">
    ${job.bullets.map(renderBullet).join('\n    ')}
  </ul>
  <p class="resume-tech">${text(`Tech: ${job.tech.join(', ')}`)}</p>
</section>`
}

// Variants will select bullets by id, so ids must stay unique.
function assertUniqueIds(resume) {
  const seen = new Set()
  const ids = [
    ...resume.skills.map((s) => s.id),
    ...resume.jobs.flatMap((job) => [job.id, ...job.bullets.map((b) => b.id)]),
  ]
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`duplicate id "${id}" in resume data`)
    seen.add(id)
  }
}

export function renderResume(resume) {
  assertUniqueIds(resume)
  const links = resume.contact.links.map(
    (link) => `<a href="${escapeHtml(link.url)}">${text(link.label)}</a>`,
  )
  return `<article class="resume">
<header class="resume-header">
  <h1 class="resume-name">${text(resume.name)}</h1>
  <p class="resume-headline">${resume.headline.map(text).join(SEPARATOR)}</p>
  <p class="resume-industries">${resume.industries.map(text).join(SEPARATOR)}</p>
  <p class="resume-contact">${[text(resume.contact.location), ...links].join(SEPARATOR)}</p>
</header>
<section>
  <h2>Summary</h2>
  <p class="resume-summary">${text(resume.summary)}</p>
  <p class="resume-summary resume-availability">${text(resume.availability)}</p>
</section>
<section>
  <h2>Technical Profile</h2>
  <ul class="resume-skills">
    ${resume.skills.map((s) => `<li><strong>${text(s.label)}:</strong> ${text(s.items.join(', '))}</li>`).join('\n    ')}
  </ul>
</section>
<section>
  <h2>Experience</h2>
  ${resume.jobs.map(renderJob).join('\n')}
</section>
<section>
  <h2>Education</h2>
  <ul class="resume-education">
    ${resume.education
      .map(
        (e) =>
          `<li><strong>${text(e.degree)}</strong>${WIDE_SEPARATOR}${text(`${e.school}, ${e.location}, ${e.year}`)}</li>`,
      )
      .join('\n    ')}
  </ul>
</section>
</article>`
}

// The build's hook for pages whose meta.json says "renderer": "resume".
// Fills {{RESUME}} in that page's content.html.
export async function renderResumePage(pageDir) {
  const resume = JSON.parse(await readFile(join(pageDir, 'resume.json'), 'utf8'))
  return { RESUME: renderResume(resume) }
}
