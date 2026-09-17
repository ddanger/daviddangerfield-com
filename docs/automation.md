# Automation Runbook

This repository uses a source-first automation model:

1. Validate page contracts from source files under `src/`
2. Build the site into `dist/` (git-ignored) and verify formatting
3. Regenerate operational artifacts (sitemap)
4. Monitor live route health

All automation scripts are ESM (`.mjs`).

## Source of Truth

Source inputs:

- `src/site.json`
- `src/pages/*/meta.json`
- `src/pages/*/content.html`
- `src/partials/*.html`

Generated output: `dist/` — never committed, rebuilt by Cloudflare Pages on
every push to `main` (build command `npm run build`, output directory
`dist`).

## Workflows

### 1) Build and Format Guardrails

File: `.github/workflows/build-and-format.yml`

Trigger:

- Pull requests
- Push to `main`

Behavior:

- Runs `npm run build` (smoke test — `dist/` isn't committed, so this just
  confirms the build still succeeds)
- Runs `npm run format:check`

### 2) PR Quality Gates (Source Validation)

File: `.github/workflows/pr-quality-gates.yml`

Trigger:

- Pull requests to `main` when source/validation files change

Behavior:

- Runs `node scripts/validate-source.mjs`
- Validates source contracts, canonical consistency, and source-level links
- Fails PR with source-file-level error output

### 3) Sitemap Auto

File: `.github/workflows/sitemap-auto.yml`

Trigger:

- Push to `main` when source/sitemap logic changes
- Manual dispatch

Behavior:

- Runs `node scripts/generate-sitemap.mjs`
- Discovers routes from `src/pages` metadata
- Excludes helper redirects (`/schedule/`, `/cv/`, `/resume/`) and `noindex` pages
- Uses git history for `lastmod`
- Commits `sitemap.xml` only when changed

### 4) Uptime Monitor

File: `.github/workflows/uptime-monitor.yml`

Trigger:

- Hourly schedule
- Manual dispatch

Behavior:

- Runs `node scripts/uptime-check.mjs`
- Auto-discovers public indexable routes from source metadata
- Prints markdown summary table
- Sends one Slack alert on failure and marks workflow failed
- Sends no Slack message on success

## Branch Protection Requirement

`sitemap-auto.yml` pushes directly to `main` after a merge.

If your ruleset does not allow GitHub Actions as a bypass actor, add `Repository admin` to bypass and use a personal token secret for workflow pushes.

## Updating the Resume PDF

When replacing `Resume-David-Dangerfield.pdf`, run through this checklist before pushing:

- [ ] Replace `Resume-David-Dangerfield.pdf` in the repo root
- [ ] Run `npm run update:resume` to regenerate `images/social/resume-share.png` and bump the cache-busting version in `src/site.json`
- [ ] Visually verify the output image looks correct
- [ ] `git add Resume-David-Dangerfield.pdf images/social/resume-share.png src/site.json`
- [ ] Commit and push — Cloudflare Pages rebuilds `dist/` from this automatically

## Required Secret

Set repository secret:

- `SLACK_WEBHOOK_URL`
- `MAIN_PUSH_TOKEN` (fine-grained PAT with repository Contents: Read and write) — used by `sitemap-auto.yml`

Path:

- GitHub repository Settings -> Secrets and variables -> Actions -> New repository secret

## Scripts

- `scripts/validate-source.mjs` - source contract + link validation
- `scripts/generate-sitemap.mjs` - source-driven sitemap generation
- `scripts/uptime-check.mjs` - route-discovered uptime checks
- `scripts/lib/routes.mjs` - shared page/route discovery
- `scripts/build.mjs` - source to `dist/` build
- `scripts/bundle-js.mjs` - bundles `src/client/` into `dist/script.js`

## Local Commands

- `npm run validate:source`
- `npm run build`
- `npm run generate:sitemap`
- `npm run check:uptime`

## Common Triage

### Source validation failure

- Check missing required fields in `src/pages/*/meta.json`
- Check canonical/og URL mismatches
- Check unresolved `href`/`src`/`srcset` references in source fragments

### Build failure

- Run `npm run build` locally and read the error — it's the same command CI runs
- Check `dist/script.js` exists before `build:html` runs (`build.mjs` hashes it for cache-busting; `npm run build` always bundles first, but running `build:html` alone without `build:js` first will fail with a clear message)

### Sitemap mismatch

- Confirm page `meta.robots` does not include `noindex` for indexable pages
- Confirm `outputPath` is correct in page metadata
- Re-run `npm run generate:sitemap`

### Uptime alert

- Review workflow job summary for failing route/status/latency
- Confirm route exists in source metadata and resolves in production
- Confirm `SLACK_WEBHOOK_URL` is valid if alerts are missing

## Process Mapping

Automation coverage for recurring maintenance from `monitoring-plan.md`:

- Link and metadata audits -> source validation gate
- Build/format guardrails -> build-and-format workflow
- Sitemap maintenance -> source-driven sitemap automation
- Availability spot checks -> scheduled uptime monitoring
