# Notes for Claude

This is a static website hosted on GitHub Pages: an interactive evidence map of opioid-policy studies. The people who maintain it are researchers, not developers, so **simplicity is the main design constraint**. Keep it a folder of plain files that works when served as-is.

## How it works

- `index.html` — markup only. Loads PapaParse 5.4.1 from cdnjs, then `config.js`, then `app.js`.
- `config.js` — `window.SITE` (title, intro, `sheetCsvUrl`, `snapshotPath`, `snapshotDate`, `onlyStatus`, `credit`) and `window.VOCAB` (alias maps from raw sheet values to display labels, and the ordered groups for map rows and columns). Routine changes belong here, not in `app.js`.
- `app.js` — one IIFE, no modules:
  - `load()` fetches `SITE.sheetCsvUrl` (a Google Sheet published to the web as CSV). If that is empty or fails, it uses `data/snapshot.csv`.
  - `normalize()` maps sheet columns by header name (case-insensitive, prefix match via `col()`), applies the vocab, and returns one object per study. Duplicate titles are counted once. Data notes go to `console.table`.
  - Design → tier mapping is in `designOf()`. Other bucketing is in `govOf`, `scopeOf`, `sizeOf`, `durOf` and `fundOf`.
  - `FACETS` defines every filter. `rail: false` facets are filterable from the figures but hidden from the left rail.
  - Views: `renderMap()` (policy × outcome gap map) and `renderFigures()` (year columns plus horizontal bar figures built by `barFigure()`). `renderList()` is the study list. One state object `F` drives everything, and `render()` redraws.
  - Hash routes: `#figures` shows the figures view; `#s-<id>` opens a study record. The id comes from the sheet's Article ID column if present, otherwise a hash of the title.
- `style.css` — colour tokens on `:root`, with dark-mode overrides in both `@media (prefers-color-scheme: dark)` and `[data-theme="dark"]`. The study-design tier colours (`--t-*`) are a validated colour-blind-safe set; keep their order.

## Rules

- No build step, framework, bundler or package.json. Don't add a dependency unless it removes a lot of code, and load it from cdnjs pinned to an exact version.
- Keep labels and groupings in `config.js` so non-developers can edit them.
- Never put secrets or API keys anywhere: the repository is public.
- Keep the snapshot fallback working.
- Test before committing: run `python3 -m http.server 8000` in the repo root, open http://localhost:8000, and check that the console has no errors. Check the map and figures views, a filter, a study record, a ~400px-wide window and dark mode.
- If the sheet's column headers change, update the names passed to `get(r, "...")` in `normalize()`, and update the list of columns in README.md.
- When adding a figure: add a facet to `FACETS` (with `rail: false` if it shouldn't appear in the rail), then call `barFigure()` in `renderFigures()`. Bars are single-colour (`--bar`) unless colour encodes a real category.
- Keep README.md's upkeep table accurate when behaviour changes.
