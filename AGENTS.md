# AGENTS

All coding agents in this repository must follow:

- .github/copilot-instructions.md

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues in this repo (ddanger/daviddangerfield-com); skills use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical labels, used as-is: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root (created lazily as needed). See `docs/agents/domain.md`.
