# ddanger.github.io

Static personal website for `ddanger.github.io`.

## The Important Rule

Edit the source files, then commit the generated HTML and `script.js` too.

GitHub Pages serves this repository as static files from the repo root. That means these generated files must stay committed:

- `index.html`
- `about/index.html`
- `services/index.html`
- `contact/index.html`
- `script.js`

Do not edit those generated files by hand for normal page changes. Edit `src/` (and `styles.css`), run the build, and commit the generated output that changes.

CI verifies that the committed artifacts match the source. A post-merge workflow can sync generated HTML on `main`, but pull requests should still include generated changes.

## Daily Workflow

1. Run `npm install` if dependencies are not installed.
2. Run `npm run dev`.
3. Edit source files under `src/`, or `styles.css` (inlined into HTML at build time).
4. Before committing, run `npm run build`.
5. Commit both your source changes and any generated HTML / `script.js` changes.

## Source vs Generated Files

Use these files for normal edits:

- `src/site.json` - shared site configuration
- `src/pages/*/meta.json` - page metadata and output paths
- `src/pages/*/content.html` - page body content
- `src/partials/*.html` - shared layout, header, and footer
- `src/client/` - source JavaScript modules (bundled into `script.js`)
- `styles.css` - global styles (inlined into each page `<head>` at build time)
- `fonts/` - self-hosted woff2 font files

These files are generated and should be committed after running the build:

- `index.html`
- `about/index.html`
- `services/index.html`
- `contact/index.html`
- `script.js`

## Commands

Start local development:

```sh
npm run dev
```

Open `http://localhost:8000`. The dev server builds once, serves the repo root, and rebuilds generated pages when `src/` changes.

Build generated HTML and format files:

```sh
npm run build
```

Run the checks CI cares about:

```sh
npm run validate:source
npm run verify:generated
npm run format:check
```

Use a different dev-server port when needed:

```sh
PORT=8010 npm run dev
```

## Requirements

- Node.js 24 or newer
- npm
- Git

Fresh clone setup:

```sh
npm run setup:init
```

For the full automation runbook, see `docs/automation.md`.

## Less Common Tasks

Regenerate the sitemap:

```sh
npm run generate:sitemap
```

Run the uptime check locally:

```sh
npm run check:uptime
```

After replacing `Resume-David-Dangerfield.pdf`, run the single resume update command to regenerate the social-share image, bump the cache-busting version, and rebuild the HTML:

```sh
npm run update:resume
```

Optional custom version:

```sh
npm run update:resume -- --version 20260901
```
