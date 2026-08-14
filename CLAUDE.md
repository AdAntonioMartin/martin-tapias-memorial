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

### Central configuration

`js/config/app-config.js` holds every data path (`APP_CONFIG.data.*`), template name
(`APP_CONFIG.templates.*`) and tree parameter (`APP_CONFIG.tree.*`). Add new paths there rather than
hardcoding literals at call sites.

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

### Images

`images/originals/` is the family archive at full resolution and is **never served or linked**.
`images/personas/<slug>/` holds the derivatives the site actually uses: `thumb` (96 px, tree
avatars), `card` (640 px, gallery), `full` (1600 px), each as WebP plus a JPEG fallback. Run
`npm run images` after adding photos.

## Adding a person

1. Create `data/personas/<id>.json`
2. Add the `id → path` entry to `data/personas-index.json`
3. Reference the `id` in `data/unions.json`
4. Drop photos in `images/personas/<id>/` and run `npm run images`
5. Run `npm run build`, then `npm run check`

## Conventions worth keeping

- All UI text lives in `data/ui-text.es.json`; the HTML carries the Spanish text as real content so
  the page is still readable if that fetch fails
- Everything interpolated into HTML goes through `escapeHtml()`; anything clickable is a real
  `<button>` or `<a>`, never a `<div>` with a listener
- Colors, spacing, type and durations come from `css/tokens.css`; `--color-accent` is decorative and
  fails contrast on small text, so use `--color-label` for labels
- The theme must be applied by the synchronous `js/theme-boot.js`, never from a module
- Errors get logged with context, never swallowed by a bare `.catch(() => …)`
