# CSS conventions

`styles.css` is one file, inlined into every page at build time. It's built on **tokens**: custom properties in the `:root` block at the top.

## Rules

- **Tokens only.** Every color, spacing, font size, line height, letter spacing, radius, shadow, and z-index comes from a token. `npm run lint:css` (Stylelint) fails on raw values for these.
- **Roles, not palette.** Components use the `--color-*` role tokens (`--color-surface`, `--color-text-muted`, `--color-border`, ...). Palette tokens (`--teal-700`, `--sand-400`, ...) appear only inside `:root`, where roles are defined. A theme, such as dark mode, redefines the roles and nothing else.
- **Snap to the scale.** Pick the nearest existing step (`--space-1` to `--space-9`, `--text-xs` to `--text-3xl`). Add a token only when a genuinely new step is needed, and add it to `:root` with the others.
- **Geometry stays literal.** Photo and icon sizes, SVG coordinates and viewBox text sizes, grid column minimums, 1px hairlines, `50%` circles, and `0` are layout facts, not design choices. Where the linter flags one, disable it for that line with a comment saying why.
- **Breakpoints:** 600px, 760px, and 900px, written as `(width <= 900px)`. They're listed in the token block's header comment; media queries can't read custom properties.
- **Motion:** durations use `--duration-fast` or `--duration-slow` with `--ease`, and every animation has a reduced-motion fallback.

## Done means

- `npm run lint:css` and `npm run format:check` pass.
- Screenshots of every page at phone, tablet, and desktop widths match before and after, except for the change you intended.
