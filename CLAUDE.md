# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static web memorial site with personal profiles and an interactive family tree visualization. Built with vanilla JavaScript (ES6 modules) and uses the `family-chart` library for genealogical rendering.

## Running the Project

The site uses `fetch()` for data loading. Serve with any static server (not `file://`):

```bash
npx serve .
# or
python -m http.server 8000
```

## Architecture

### Entry Points
- `index.html` → `js/app.js`: Person listing/memorial table
- `persona.html` → `js/detail.js`: Individual person profile
- `arbol.html` → `js/arbol.js`: Family tree visualization

### Data Flow

**Central Configuration**: `js/config/app-config.js` defines all paths (`APP_CONFIG.data.*`) and templates (`APP_CONFIG.templates.*`).

**Tree System**: Supports multiple family trees via URL parameter `?tree=<key>`. Every person record physically lives in exactly one place — the `personas/` folder of whichever tree first needed it — and is never duplicated. Other trees that also need that person reference it by pointing their index at that same path (a cross-reference, not a copy):
- `data/trees/index.json`: Registry of available trees
- `data/trees/<key>/arbol.json`: Family unions (relationships) scoped to that tree
- `data/trees/<key>/personas/*.json`: Person records "owned" by that tree (created there first)
- `data/trees/<key>/personas-index.json`: Person ID → path mapping. Entries for that tree's own people point into its own `personas/` folder; entries for people shared with other trees point across into whichever tree's `personas/` folder actually holds the file
- `data/personas-index.json` (root): merged view of all trees' `byId` maps, pointing at each person's real path — used by pages that list/resolve people without a `?tree=` filter (the listing page, and detail-page fallback)
- At load time, a tree's `personas-index.json` is merged over the root index (tree entries win) — see `loadTreePayload()` / `fetchPersonIndex()` below

**Data Transformation Pipeline** (`js/tree/data.js`):
1. `resolveTreeSources()` → selects tree config based on URL/default
2. `loadTreePayload()` → fetches unions + person records
3. `mapFamilyChartData()` → transforms to family-chart format (`{id, data, rels}`)

### Module Organization

- `js/core/`: Shared utilities (html, text, dates, url, net, i18n, theme)
- `js/listing/`: Table rendering (columns, sort, config, data, render)
- `js/detail/`: Person profile (data, render)
- `js/tree/`: Family tree (data, graph, panel, config)

### Key Patterns

- Person records have `__id` and `__path` injected after loading
- Gender: stored as "male"/"female"/"unknown", converted to "M"/"F" for family-chart
- Image paths can in principle be remapped via `imagesBase` in tree config (`remapImagePath()` in `js/tree/data.js`), but no tree currently uses per-tree images — all images live in the shared `images/personas/<slug>/` folder regardless of which tree's `personas/` folder holds the person's JSON record
- UI text is externalized in `data/ui-text.es.json` and applied via `js/core/i18n.js`

## Adding a Person

1. Create `data/trees/<key>/personas/<slug>.json`, where `<key>` is the tree you're currently working in — that tree becomes the person's permanent home (never move the file later, even if other trees start referencing it)
2. Add entry to that tree's `data/trees/<key>/personas-index.json` under `byId`, and also to the root `data/personas-index.json` (so listing/detail pages without `?tree=` can resolve them)
3. Reference the person's ID in `data/trees/<key>/arbol.json` unions to include them in that tree
4. If the person should also appear in another tree, do **not** copy the file — add one more `byId` entry in that other tree's `personas-index.json` pointing at the same `data/trees/<key>/personas/<slug>.json` path, and reference their ID in that tree's `arbol.json` too