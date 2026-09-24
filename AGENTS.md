# AGENTS

All coding agents in this repository must follow:

- .github/copilot-instructions.md

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues in this repo (ddanger/daviddangerfield-com); skills use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical labels, used as-is: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Code comments

Comments are for agents, and they stay next to the code they explain. Write one only for what reading the code can't tell you: a reason, a constraint, or a gotcha someone would otherwise "fix." Leave out comments that restate the code, label sections, or describe how things used to be.

### CSS

Writing or editing any styles in `styles.css`: follow `docs/agents/css.md`.

### Site copy

Writing or editing any visitor-facing text (page content, meta tags, social cards): follow `docs/agents/voice.md`.

### Resume

`src/pages/resume/` is the resume's source; `Resume-David-Dangerfield.pdf` is printed from it. After editing it, run `npm run update:resume` and leave the PDF for David to review before anything is committed. See the README, **Updating the Resume**.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root (created lazily as needed). See `docs/agents/domain.md`.
