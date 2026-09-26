---
name: visual-check
description: Screenshot a website's pages at phone/tablet/desktop widths in light and dark mode, and check them for axe accessibility violations, horizontal overflow, console errors, failed requests, and optionally Lighthouse scores. Use when verifying a UI or CSS change, checking a page renders correctly, auditing accessibility or performance, or when about to write an ad-hoc Playwright screenshot script.
---

# Visual check

Run the bundled script instead of writing Playwright, axe, or Lighthouse code by hand.

```sh
node .claude/skills/visual-check/check.mjs [options]
```

Run it from the repo root. It reads `.visual-check.json` there if present; command-line options override it.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `--url <base>` | | Check a running site (local dev server or production). Skips `build`. |
| `--serve <dir>` | | Serve a static build directory on a random port (clean URLs, `404.html`). |
| `--build <cmd>` | | Command to run before serving. `--no-build` skips it. |
| `--routes /a/,/b/` | `/` | Paths to check. |
| `--sitemap <path or URL>` | | Take routes from a sitemap; its origin is ignored, only paths are used. |
| `--widths 375,768,1280` | same | Viewport widths. Under 600px emulates a touch phone. |
| `--themes light,dark` | same | `prefers-color-scheme` values. |
| `--lighthouse` | off | Also run Lighthouse mobile once per route (slow, about 10s each). |
| `--no-axe` | | Skip axe. |
| `--viewport-only` | | Screenshot the first screen instead of the full page. |
| `--out <dir>` | a new temp dir | Where screenshots and `summary.md` go. Pass the session scratchpad. |

`.visual-check.json` uses the same keys, for example:

```json
{ "build": "npm run build", "serve": "dist", "sitemap": "sitemap.xml" }
```

## Output

It prints a Markdown summary (also saved to `<out>/summary.md`) listing every route, width, and theme as `OK` or with its problems. Screenshots are `<out>/<route>-<width>-<theme>.png`. Exit code: 0 clean, 1 problems found, 2 the script itself failed.

The summary doesn't prove the page looks right. Read the screenshots for the pages you changed, at least the phone width in both themes.

## Workflow

- Checking a change: limit `--routes` to the affected pages; run every route only for site-wide CSS or layout changes.
- Before a full run, confirm the build succeeds on its own, so a build error isn't mistaken for a check failure.
- Production: `--url https://example.com --sitemap /sitemap.xml`.

## Setup

Dependencies are pinned in this folder. If the script can't find `playwright` or a browser:

```sh
cd .claude/skills/visual-check && npm install && npx playwright install chromium
```
