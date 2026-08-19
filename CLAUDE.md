# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**This repository holds data, not code.** It is the memorial for the Martín - Tapias family: person
records, kinship and photographs. The site's code lives in
[family-tree-engine](https://github.com/AdAntonioMartin/family-tree-engine) and arrives as an npm
dependency, so improving the engine benefits every family site without copying anything by hand.

If a change belongs to how the site *works* — layout, styles, tree rendering, tools — it goes in the
engine repo, not here. What belongs here is what makes this memorial *this* family.

## Running and checking

```bash
npm install
npm run serve      # builds dist/ and serves it at http://localhost:4321
npm run check      # build + data validation — run this before finishing
npm run smoke      # real-browser pass over the three pages, keyboard and mobile
```

`npm run build` produces `dist/`, which is what gets published: these data merged with the engine's
code. `dist/` is not committed. There is no lint or unit-test step here — those live in the engine.

## What is here

- `site.config.json` — name, description(s), baseUrl, lang, theme, favicon. Everything that makes
  this site distinct from another memorial
- `data/personas/<id>.json` — every person record lives here, nowhere else
- `data/personas-index.json` — `id → path` for all 161 records
- `data/unions.json` — the 59 unions (partners + children); the only source of kinship
- `data/trees/index.json` — family *views*, not separate trees
- `data/lista.json` — which people and columns the listing shows
- `images/personas/<slug>/` — the derivatives the site serves
- `images/originals/` — full-resolution family archive, **never published** (the build excludes it)
- `site-text.es.json` — optional, only to override specific UI strings from the engine

`data/tree-bundle.json` and `data/ui-text.es.json` are **generated into `dist/`** and must not be
committed here.

A "tree" (`?tree=<key>`) is a **view over the single graph**, defined by a `rootPersonId`. The
subgraph is computed at runtime. Never reintroduce per-family union files.

## Person record schema

`id`, `name`, `gender` (`male`/`female`/`unknown`), `born`, `died` (ISO, partial precision allowed),
`summary`, `heroImage`, `gallery`, `facts`. Optional: `unknownNameParts`, `notes`, `sources`,
`biography`.

Rules enforced by `npm run validate`:
- IDs must match `^[a-z0-9-]+$` — they travel in URLs and in CSS selectors
- `facts` labels come from a vocabulary declared in the engine's `factsSchema` (not hardcoded here);
  facts with an empty value are not allowed
- names must not contain `?`; use `unknownNameParts` for unknown surnames
- every image path referenced must exist on disk
- the tree bundle must be reproducible from the records — a stale one is an error

**Don't duplicate `name`/`born`/`died` or the union graph into `facts`.** "Nombre completo",
"Nacimiento", "Fallecimiento", "Edad", "Padres", "Pareja" and "Hijos" are computed by the engine at
render time (from `name`/`born`/`died`, and from `data/unions.json` for the three relations) —
`npm run validate` rejects storing one of these as a fact when the data it would be computed from is
already present. Padres/Pareja/Hijos render as links to each relative's own ficha, not plain text.
Storing one by hand is only valid as a fallback for what the computation can't cover: a placeholder
like `"Pendiente de documentar"` while `born`/`died` is still `""`, or a `"Padres"` for someone whose
parents aren't in `data/unions.json` (see `lazara-otero-velasco.json`, whose parents don't exist as
records — Pareja/Hijos have no such fallback, nothing has ever stored them by hand). Same
idea for photo `alt`: leave it unset and the engine computes one from `name`/`caption`; only set it
by hand for something more descriptive than the mechanical default.

## Adding a person

1. Create `data/personas/<id>.json`
2. Add the `id → path` entry to `data/personas-index.json`
3. Reference the `id` in `data/unions.json`
4. Add photos with `npm run add-photo -- <id> <foto> [--hero]`
5. Run `npm run check`

## Images

To add one photo to an existing person, prefer `npm run add-photo` — it generates the derivatives
*and* writes the image block into the record, which is otherwise a dozen paths copied by hand:

```bash
npm run add-photo -- <id> <ruta-a-la-foto> [--hero] [--alt "…"] [--caption "…"] [--dry-run]
```

Without `--hero` the image is appended to `gallery`. It is idempotent: derivatives already on disk
are not re-encoded (`--force` overrides) and a photo the record already references is not added
twice. `npm run images` remains the bulk pass that dedupes a folder of new drops by hash.

Note "having photos" means having derivatives (`heroImage.full`), not having a `heroImage`: records
without a photograph still carry one pointing at the generic `images/retrato.svg`.

## Publishing

Every push to `main` runs the workflow that builds `dist/` and deploys it to GitHub Pages. The Pages
source must be set to **GitHub Actions** in the repository settings — with the older "Deploy from a
branch" it would publish a repo that has no `index.html`.

Dependabot opens a PR when the engine publishes a new tag; CI builds and validates these data
against that version before it can be merged.
