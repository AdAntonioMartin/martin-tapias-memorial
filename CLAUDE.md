# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static memorial site with a person listing, individual profiles, and an interactive family tree.
Vanilla JavaScript (ES modules), no framework and no bundler. The `family-chart` library and D3 are
vendored under `vendor/` and served from the site itself.

## Running and checking

Pages load data with `fetch`, so they must be served over HTTP:

```bash
npm install
npm run serve      # http://localhost:4321
npm run check      # lint + build + tests + data validation — run this before finishing
npm run smoke      # real-browser pass over the three pages, keyboard and mobile
```

Do not use `npx serve`: it rewrites URLs to drop the `.html` extension and loses the query string in
the redirect, so `?id=` and `?tree=` never arrive. `tools/serve.mjs` exists for this reason.

## Architecture

### Entry points

- `index.html` → `js/app.js` — listing table
- `persona.html` → `js/detail.js` — individual profile
- `arbol.html` → `js/arbol.js` — family tree

All three go through `bootstrapPage()` (`js/core/bootstrap.js`): apply theme → wait for
`DOMContentLoaded` → load UI text → apply i18n → run the page's `init`.

### Site identity vs engine

The repo is being split so the code can become a shared library and each family keeps its own data
repo. The rule that makes that possible: **no file under `js/`, `css/`, `tools/`, `templates/` or
`defaults/` may name a family, a person or a domain.** Everything site-specific lives in
`site.config.json` (name, description, baseUrl, lang, theme, favicon).

Four files are **generated** and must not be edited by hand:

| Generated | From |
|---|---|
| `index.html`, `arbol.html`, `persona.html` | `templates/*.html` + `site.config.json` |
| `js/config/app-config.js` | `defaults/app-config.json` + `site.config.json` |
| `data/ui-text.es.json` | `defaults/ui-text.es.json` + `site.config.json` |

`tools/build-site.mjs` writes them (`npm run build`); `npm run build:check` fails if any drifted,
and CI runs it. Templates use `{{siteName}}`, `{{descriptions.tree}}` and friends — HTML values are
escaped, UI-text values are not, because `applyI18nToDom` writes them with `textContent`.

Optional per-site wording overrides go in `site-text.es.json` at the root, deep-merged over
`defaults/ui-text.es.json`.

### Central configuration

`APP_CONFIG` holds the theme, every data path (`APP_CONFIG.data.*`), template name
(`APP_CONFIG.templates.*`), tree parameter (`APP_CONFIG.tree.*`) and `siteName`. Add new paths to
`defaults/app-config.json` rather than hardcoding literals at call sites.

The generated `js/config/app-config.js` is deliberately **a classic script, not an ES module**: it
assigns `window.APP_CONFIG` and is loaded synchronously in `<head>` before `js/theme-boot.js`, which
needs the theme before first paint. Modules read it through `js/config/index.js`, which only
re-exposes it — import from there, never from `app-config.js`. If you make it a module the theme
silently stops working and a flash returns.

### Tools run against the current directory

Every script in `tools/` resolves the site as `process.cwd()` (`siteRoot()` in
`tools/lib/site-config.mjs`), never relative to its own file. That is what lets them keep working
once the code lives in `node_modules` of a data repo. `build-site.mjs` and `smoke.mjs` also keep an
`ENGINE_ROOT` for the files that travel with the code (templates, defaults, `serve.mjs`).

### Data model

One source of truth per thing. There is **no** per-family copy of anything:

- `data/personas/<id>.json` — every person record lives here, nowhere else
- `data/personas-index.json` — `id → path` for all 161 records
- `data/unions.json` — the 59 unions (partners + children); the only source of kinship
- `data/tree-bundle.json` — **generated**, do not edit by hand; see below
- `data/trees/index.json` — family *views*, not separate trees

A "tree" (`?tree=<key>`) is a **view over the single graph**, defined by a `rootPersonId`. The
subgraph is computed at runtime by `js/tree/scope.js`. Never reintroduce per-family union files.

### The generated bundle

`data/tree-bundle.json` carries the unions plus, per person, only what a card needs. The tree page
loads it instead of fetching 161 individual records. **Any change to a person record or to
`data/unions.json` requires `npm run build`**, and CI fails if the committed bundle is stale.

### Person record schema

`id`, `name`, `gender` (`male`/`female`/`unknown`), `born`, `died` (ISO, partial precision allowed),
`summary`, `heroImage`, `gallery`, `facts`. Optional: `unknownNameParts`, `notes`, `sources`,
`biography`.

Rules enforced by `tools/validate-data.mjs`:
- IDs must match `^[a-z0-9-]+$` — they travel in URLs and in CSS selectors
- `facts` labels come from a closed vocabulary; facts with an empty value are not allowed
- names must not contain `?`; use `unknownNameParts` for unknown surnames
- every image path referenced must exist on disk

### Tree pipeline

`loadTreePayload()` (`js/tree/data.js`) → `buildTreeModel()` (`js/tree/model.js`) →
`toFamilyChartData()` → `collectScopeIds()`/`scopeFamilyChartData()` (`js/tree/scope.js`).

`js/tree/model.js` is the **single** representation of the graph; it feeds both the side panel and
family-chart. Do not build a second parallel structure.

### Tests vs data validation

`tests/` covers engine behaviour only and runs against the synthetic graph in
`tests/fixtures/family.js` — it must never read `data/`, or it cannot travel with the code. Checks
about *this* family's data (bundle freshness, ids, unions, images, views that overlap) live in
`tools/validate-data.mjs` and run with `npm run validate`. `tools/smoke.mjs` derives its sample
person and tree keys from `data/` at runtime for the same reason.

### Images

`images/originals/` is the family archive at full resolution and is **never served or linked**.
`images/personas/<slug>/` holds the derivatives the site actually uses: `thumb` (96 px, tree
avatars), `card` (640 px, gallery), `full` (1600 px), each as WebP plus a JPEG fallback.

To add one photo to an existing person, prefer `npm run add-photo` — it generates the derivatives
*and* writes the image block into the person record, which is otherwise a dozen paths copied by
hand:

```bash
npm run add-photo -- <id> <ruta-a-la-foto> [--hero] [--alt "…"] [--caption "…"] [--dry-run]
```

Without `--hero` the image is appended to `gallery`. Both tools are idempotent: derivatives already
on disk are not re-encoded (`--force` overrides) and a photo the record already references is not
added twice, so re-running is safe. `npm run images` remains the bulk pass that dedupes a folder of
new drops by hash; it skips files that are already derivatives.

## Adding a person

1. Create `data/personas/<id>.json`
2. Add the `id → path` entry to `data/personas-index.json`
3. Reference the `id` in `data/unions.json`
4. Add photos with `npm run add-photo -- <id> <foto> [--hero]` (or drop many in
   `images/personas/<id>/` and run `npm run images`)
5. Run `npm run build`, then `npm run check`

## Conventions worth keeping

- All UI text lives in `data/ui-text.es.json`; the HTML carries the Spanish text as real content so
  the page is still readable if that fetch fails
- Everything interpolated into HTML goes through `escapeHtml()`; anything clickable is a real
  `<button>` or `<a>`, never a `<div>` with a listener
- Colors, spacing, type and durations come from `css/tokens.css`; `--color-accent` is decorative and
  fails contrast on small text, so use `--color-label` for labels
- Gender in the tree is encoded four ways at once — top band, background tint (`--gender-tint`,
  higher in the dark theme), avatar ring, and the initial shown when there is no portrait — plus a
  legend. Color is never the only cue, and hover/selection must not overwrite the gender band
- The theme must be applied by the synchronous `js/theme-boot.js`, never from a module.
  `APP_CONFIG.theme` outranks `prefers-color-scheme`; only an explicit visitor choice in
  `localStorage` outranks the config. Use `theme: "auto"` to follow the system instead
- Errors get logged with context, never swallowed by a bare `.catch(() => …)`
