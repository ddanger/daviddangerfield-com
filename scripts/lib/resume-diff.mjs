// Describes how a resume variant differs from the canonical resume, as
// Markdown for review.md. Content is matched by id, so reworded, reordered,
// removed, and new items each show up as what they are. Text that isn't in the
// canonical resume is called out separately: it's the part to fact-check.

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function byId(items) {
  return new Map(items.map((item) => [item.id, item]))
}

function listChanges(label, before, after, fresh) {
  if (same(before, after)) return []
  const added = after.filter((x) => !before.includes(x))
  if (added.length) fresh.push(`${label}: added ${added.join(', ')}`)
  const removed = before.filter((x) => !after.includes(x))
  const parts = []
  if (added.length) parts.push(`added ${added.join(', ')}`)
  if (removed.length) parts.push(`removed ${removed.join(', ')}`)
  if (!added.length && !removed.length) parts.push('reordered')
  return [`- ${label}: ${parts.join('; ')}`]
}

function orderChange(label, before, after) {
  const kept = after.filter((id) => before.includes(id))
  const baseOrder = before.filter((id) => after.includes(id))
  return same(kept, baseOrder) ? [] : [`- ${label} reordered: ${after.join(', ')}`]
}

function textChange(label, before, after, fresh) {
  if (same(before, after)) return []
  fresh.push(`${label}: ${after}`)
  return [`- ${label}`, `  - was: ${before}`, `  - now: ${after}`]
}

function jobChanges(base, job, fresh) {
  const lines = []
  for (const field of [
    'title',
    'engagement',
    'employer',
    'employerNote',
    'location',
    'start',
    'end',
  ]) {
    if (!same(base[field], job[field])) {
      lines.push(`- ${field}: ${base[field] ?? '(none)'} → ${job[field] ?? '(none)'}`)
      fresh.push(`${job.id} ${field}: ${job[field] ?? '(removed)'}`)
    }
  }

  const baseBullets = byId(base.bullets)
  const bulletIds = job.bullets.map((b) => b.id)
  for (const bullet of base.bullets) {
    if (!bulletIds.includes(bullet.id)) lines.push(`- removed bullet ${bullet.id}`)
  }
  for (const bullet of job.bullets) {
    const original = baseBullets.get(bullet.id)
    if (!original) {
      lines.push(`- new bullet ${bullet.id}`, `  - now: ${bullet.text}`)
      fresh.push(`bullet ${bullet.id}: ${bullet.text}`)
    } else if (!same(original, bullet)) {
      lines.push(...textChange(`bullet ${bullet.id}`, original.text, bullet.text, fresh))
      if (original.lead !== bullet.lead)
        lines.push(`- bullet ${bullet.id} bold lead: "${bullet.lead}"`)
    }
  }
  lines.push(
    ...orderChange(
      'bullets',
      base.bullets.map((b) => b.id),
      bulletIds,
    ),
  )
  lines.push(...listChanges(`${job.id} tech`, base.tech, job.tech, fresh))
  return lines
}

export function diffResumes(base, variant) {
  const sections = []
  const fresh = []
  const section = (title, lines) => {
    if (lines.length) sections.push(`### ${title}\n\n${lines.join('\n')}`)
  }

  section('Header', [
    ...textChange('name', base.name, variant.name, fresh),
    ...textChange('headline', base.headline.join(' | '), variant.headline.join(' | '), fresh),
    ...textChange('industries', base.industries.join(' | '), variant.industries.join(' | '), fresh),
    ...textChange('contact', JSON.stringify(base.contact), JSON.stringify(variant.contact), fresh),
  ])
  section('Summary', [
    ...textChange('summary', base.summary, variant.summary, fresh),
    ...textChange('availability', base.availability, variant.availability, fresh),
  ])

  const baseSkills = byId(base.skills)
  const skillLines = []
  for (const group of variant.skills) {
    const original = baseSkills.get(group.id)
    if (!original) {
      skillLines.push(`- new group ${group.id}: ${group.label}: ${group.items.join(', ')}`)
      fresh.push(`skills ${group.label}: ${group.items.join(', ')}`)
      continue
    }
    if (original.label !== group.label) skillLines.push(`- ${group.id} label: ${group.label}`)
    skillLines.push(...listChanges(group.label, original.items, group.items, fresh))
  }
  for (const group of base.skills) {
    if (!variant.skills.some((g) => g.id === group.id))
      skillLines.push(`- removed group ${group.id}`)
  }
  skillLines.push(
    ...orderChange(
      'groups',
      base.skills.map((g) => g.id),
      variant.skills.map((g) => g.id),
    ),
  )
  section('Technical profile', skillLines)

  const baseJobs = byId(base.jobs)
  const jobIds = variant.jobs.map((j) => j.id)
  const jobLines = []
  for (const job of base.jobs) {
    if (!jobIds.includes(job.id)) jobLines.push(`- removed job ${job.id}`)
  }
  jobLines.push(
    ...orderChange(
      'jobs',
      base.jobs.map((j) => j.id),
      jobIds,
    ),
  )
  section('Experience', jobLines)
  for (const job of variant.jobs) {
    const original = baseJobs.get(job.id)
    if (!original) {
      section(`New job: ${job.id}`, [`- ${job.title}, ${job.employer}`])
      fresh.push(`job ${job.id}: ${job.title}, ${job.employer}`)
      for (const bullet of job.bullets) fresh.push(`bullet ${bullet.id}: ${bullet.text}`)
    } else {
      section(`${original.employer} (${job.id})`, jobChanges(original, job, fresh))
    }
  }

  const education = (list) => list.map((e) => `${e.degree}, ${e.school}, ${e.location}, ${e.year}`)
  section(
    'Education',
    textChange(
      'education',
      education(base.education).join('; '),
      education(variant.education).join('; '),
      fresh,
    ),
  )

  const changes = sections.length ? sections.join('\n\n') : 'No changes from the canonical resume.'
  const newText = fresh.length
    ? fresh.map((line) => `- ${line}`).join('\n')
    : 'None: every line is in the canonical resume.'
  return { changes, newText, changeCount: sections.length, newCount: fresh.length }
}
