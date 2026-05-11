# Architecture — LILA BLACK / FIELD INTEL

**Scope:** One-page overview of stack, data flow, coordinate mapping, assumptions, and tradeoffs.

---

## What we built (and why)

| Piece | Choice | Why |
|--------|--------|-----|
| **App shell** | React 18 + TypeScript + Vite | Fast dev loop, first-class TS, easy static deploy. |
| **State** | Zustand | Minimal boilerplate; global `rawEvents`, filters, and playback fit a single store. |
| **Map** | Leaflet + custom `CRS.Simple` | Need image-aligned 2D overlay (1024×1024 minimaps), not lon/lat geography. |
| **Parquet** | `parquet-wasm` + Apache Arrow (IPC) in a **Web Worker** pool | Keeps UI thread responsive; columnar reads match row-heavy telemetry. |
| **ZIP** | JSZip in main thread | Spec expects `player_data.zip`; small enough to unzip then fan out buffers to workers. |
| **Heatmap** | `leaflet.heat` | Quick density view for kills / deaths / position samples without server aggregation. |
| **Charts** | Recharts | Lightweight event-density strip on the timeline scrubber. |
| **Styling** | Tailwind v4 + design tokens (`theme.css`) | Consistent “field intel” UI without a component library lock-in for the map shell. |

**WASM note:** `parquet-wasm` expects **COOP/COEP** headers in dev (`vite.config.ts`) and prod (`netlify.toml`) so shared memory paths behave reliably across browsers.

---

## Data flow (ZIP → screen)

1. **Upload / drag-drop** → `useStore.loadZip` → `loadZipFile` (JSZip).
2. **ZIP scan** → Collect `February_*/*.{nakama-0}` parquet buffers + `minimaps/*` blobs → object URLs for PNG/JPG.
3. **Parse** → Up to 4 workers (`parquet.worker.ts`) each: WASM read → Arrow table → iterate columns (`user_id`, `match_id`, `map_id`, `x`, `y`, `z`, `ts`, `event`) → build `GameEvent[]` with **`pixelX` / `pixelY` precomputed** via `worldToPixel`.
4. **Index** → `buildMatchIndex` groups by `matchId|mapId|date`, counts humans/bots/kills/deaths/loot/storm, derives `startTs` / `endTs` / `duration`.
5. **UI** → Left panel filters + match pick; bottom timeline sets `currentTimestamp`; `MapCanvas` filters `rawEvents` by match, time, event toggles, human/bot toggles → Leaflet markers / polylines / heat layer.

No backend: everything runs in the browser.

---

## Game coordinates → minimap pixels (the tricky part)

**Goal:** Place world `(x, y, z)` on a **1024×1024** minimap image per map.

**Assumption:** Horizontal placement uses **world X and Z** (ground plane); **Y is vertical** and is **not** used for the 2D minimap pin (matches common game layout where XZ is the map plane).

**Per-map affine mapping** (`src/lib/coordinates.ts`):

1. Subtract a map-specific **origin** in world space: `(x - originX)`, `(z - originZ)`.
2. Divide by **scale** (world units per “normalized” 0–1 tile): `u`, `v` in ~0–1 over the playable footprint.
3. Map to pixels: `pixelX = u * 1024`, `pixelY = (1 - v) * 1024` — **flip V** so image-space “up” matches north on art (minimap image origin is top-left; Leaflet CRS then applies another Y flip when converting to `LatLng`; see `MapCanvas` `toLatLng`).

**Tuning:** `scale`, `originX`, and `originZ` are **constants per `MapId`** (`MAP_CONFIG`). They were chosen so clusters align with roads/POIs on bundled minimap art; wrong constants show systematic drift (whole cloud shifted), which is easier to spot than per-row noise.

**Leaflet glue:** Markers use `[1024 - pixelY, pixelX]` in custom CRS so the dot lands on the same pixel as the image editor would address `(pixelX, pixelY)` from top-left.

---

## Ambiguous data — what we assumed

| Ambiguity | Handling |
|-----------|----------|
| **Human vs bot** | No `is_bot` column in sample schema → **`user_id` contains `-` ⇒ human (UUID), else bot** (see worker/parser). |
| **Parquet event column type** | Sometimes string, sometimes binary → decode `Uint8Array` to string before enum match. |
| **`match_id` suffix** | Strip trailing `.nakama-0` so one logical match doesn’t split. |
| **Timestamp type** | Arrow may expose `Int64` / `BigInt` → normalize to JS `number` for comparisons. |
| **Rows with bad numbers** | Skip row on parse failure; worker continues. |
| **Killer / weapon / victim link** | Not in parsed columns → tooltips show **event + position + time** only; no kill-feed graph. |

---

## Tradeoffs (what we considered)

| Topic | Option A | Option B | Decision |
|-------|-----------|-----------|------------|
| **Parse location** | Main thread | Web Workers | **Workers** — UI stays usable on many files. |
| **Coordinates** | Recompute every frame | Precompute at ingest | **Precompute** — simpler Leaflet updates. |
| **Trails** | Full polyline per player | Same, debounced rebuild | **Debounced 150ms** — balance scrub smoothness vs work. |
| **Heatmap** | Server tiles | Client `leaflet.heat` | **Client** — zero infra; caps at “good enough” for exploration. |
| **CRS** | Geographic map | Custom simple CRS | **Custom** — minimaps are not geo-registered. |
| **Bot UX** | Separate layer | Shared markers + ring color | **Shared + encoding** — fewer layers, one mental model. |

---

## Key source files

- `src/lib/zipLoader.ts` — ZIP layout assumptions.  
- `src/workers/parquet.worker.ts` — Parquet → `GameEvent`.  
- `src/lib/coordinates.ts` — `MAP_CONFIG`, `worldToPixel`.  
- `src/lib/matchBuilder.ts` — Match rollups.  
- `src/store/useStore.ts` — Orchestration + playback.  
- `src/components/map/MapCanvas.tsx` — Leaflet + `toLatLng`, markers, trails, heatmap.  

---

*End of one-page architecture summary.*
