LILA BLACK — FIELD INTEL
Complete Project Prompt

PROJECT OVERVIEW
Build a single-page, browser-based game analytics dashboard called "LILA BLACK — FIELD INTEL". This tool is used by Level Designers at a game studio to analyze player behavior on game maps using raw telemetry data from a battle-royale extraction shooter.
The tool must work entirely in the browser with no backend. The user uploads a ZIP file containing parquet data files and minimap images. All parsing, processing, and visualization happens client-side.
The final result must be deployable to Netlify as a static site.

TECH STACK

Framework: React 18 + Vite
Language: TypeScript
Styling: Tailwind CSS (with custom config for the design system)
Map/Canvas: Leaflet.js with a custom CRS (Coordinate Reference System) for image overlays
Parquet Parsing: parquet-wasm (WebAssembly parquet reader, runs in browser)
ZIP Parsing: JSZip (extract files from uploaded ZIP in browser)
Heatmap: leaflet-heat plugin
State Management: Zustand
Charts/Stats: Recharts (for the timeline event density chart)
Deployment: Netlify (static, no serverless functions needed)


DESIGN SYSTEM
This is the single most important constraint. Every UI decision must follow this.
Philosophy: Minimal Brutalism + Military Intelligence Terminal. Think raw developer tooling crossed with a field operations display. Not a consumer SaaS product. Not an AI startup dashboard. Functional, cold, precise.
Colors (use CSS variables):
--bg-base: #0A0A0A
--bg-surface: #111111
--bg-elevated: #1A1A1A
--border: #2A2A2A
--border-active: #444444
--text-primary: #E8E8E8
--text-secondary: #666666
--text-muted: #3A3A3A
--accent: #C8FF00
--accent-text: #000000
--event-kill: #FF8C00
--event-death: #FF3B3B
--event-loot: #4DAAFF
--event-storm: #9B59FF
--event-position: #444444
Typography:

IBM Plex Mono — all labels, data values, timestamps, IDs, monospace content
Inter — UI text, descriptions, longer strings
Label style: ALL CAPS, letter-spacing: 0.1em, font-size: 10px, color --text-secondary
Data value style: font-size: 13px, color --text-primary, IBM Plex Mono

Borders & Shapes:

Zero border-radius everywhere (or max 2px, never more)
All borders: 1px solid var(--border)
Active/hover borders: 1px solid var(--border-active)
No drop shadows
No gradients
No glassmorphism
No blur effects

Interactive States:

Default: --border border, --text-secondary label
Hover: --border-active border, --text-primary label
Active/Selected: --accent background, --accent-text text (black on yellow)
Disabled: --text-muted text, no border change


DATA FORMAT (read this carefully — the parsing must be exact)
The user uploads a ZIP file. Inside the ZIP:
player_data/
├── February_10/     (parquet files)
├── February_11/     (parquet files)
├── February_12/     (parquet files)
├── February_13/     (parquet files)
├── February_14/     (parquet files)
├── minimaps/
│   ├── AmbroseValley_Minimap.png
│   ├── GrandRift_Minimap.png
│   └── Lockdown_Minimap.jpg
└── README.md
Parquet File Naming Convention:
{user_id}_{match_id}.nakama-0

If user_id is a UUID → human player
If user_id is a short number (e.g. 1440) → bot

Parquet Schema (each file is one player in one match):
ColumnTypeNotesuser_idstringUUID = human, numeric = botmatch_idstringHas .nakama-0 suffix, strip it for displaymap_idstringAmbroseValley, GrandRift, or Lockdownxfloat32World X coordinateyfloat32Elevation (ignore for 2D map plotting)zfloat32World Z coordinatetstimestamp (ms)Time elapsed within match, not wall clockeventbinary/bytesDecode to UTF-8 string
Event Types:
Position       — human movement sample
BotPosition    — bot movement sample
Kill           — human killed a human
Killed         — human was killed by human
BotKill        — human killed a bot
BotKilled      — human killed by bot
KilledByStorm  — player died to storm
Loot           — player picked up item
Coordinate → Minimap Pixel Conversion (CRITICAL — must implement exactly):
javascriptconst MAP_CONFIG = {
  AmbroseValley: { scale: 900,  originX: -370, originZ: -473 },
  GrandRift:     { scale: 581,  originX: -290, originZ: -290 },
  Lockdown:      { scale: 1000, originX: -500, originZ: -500 },
}

function worldToPixel(x, z, mapId) {
  const { scale, originX, originZ } = MAP_CONFIG[mapId]
  const u = (x - originX) / scale
  const v = (z - originZ) / scale
  const pixelX = u * 1024
  const pixelY = (1 - v) * 1024  // Y is flipped — image origin is top-left
  return { pixelX, pixelY }
}
The minimap images are 1024×1024 pixels. All event markers must land on the correct pixel.

APPLICATION ARCHITECTURE
src/
├── main.tsx
├── App.tsx
├── store/
│   └── useStore.ts          # Zustand store — all global state
├── workers/
│   └── parquet.worker.ts    # Web Worker for parsing parquet files
├── lib/
│   ├── zipLoader.ts         # JSZip: extract files from ZIP
│   ├── parquetParser.ts     # parquet-wasm: parse parquet → JS objects
│   ├── coordinates.ts       # worldToPixel(), MAP_CONFIG
│   ├── matchBuilder.ts      # Aggregate files into match objects
│   └── heatmapBuilder.ts    # Build heatmap data arrays
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── LeftPanel.tsx
│   │   └── BottomTimeline.tsx
│   ├── upload/
│   │   └── DropZone.tsx
│   ├── map/
│   │   ├── MapCanvas.tsx        # Leaflet map with image overlay
│   │   ├── EventMarkers.tsx     # Kill/death/loot/storm markers
│   │   ├── PositionTrails.tsx   # Player path polylines
│   │   └── HeatmapLayer.tsx     # leaflet-heat integration
│   ├── filters/
│   │   ├── DateFilter.tsx
│   │   ├── MatchFilter.tsx
│   │   ├── PlayerTypeFilter.tsx
│   │   ├── EventTypeFilter.tsx
│   │   └── OverlayFilter.tsx
│   └── stats/
│       └── MatchStats.tsx
├── types/
│   └── index.ts             # All TypeScript interfaces
└── styles/
    └── globals.css          # CSS variables + base styles

ZUSTAND STORE SHAPE
typescriptinterface AppState {
  // Data
  rawEvents: GameEvent[]
  matches: Match[]
  minimapImages: Record<string, string>  // mapId → object URL
  
  // Filters
  selectedMap: 'AmbroseValley' | 'GrandRift' | 'Lockdown'
  selectedMatchId: string | null
  selectedDates: [string, string] | null
  showHumans: boolean
  showBots: boolean
  activeEvents: EventType[]
  overlayMode: 'none' | 'kill' | 'death' | 'traffic'
  
  // Timeline
  timelinePosition: number        // 0–1, normalized
  isPlaying: boolean
  playbackSpeed: 0.5 | 1 | 2 | 4
  matchDuration: number           // ms
  currentTimestamp: number        // ms
  
  // UI
  isLoading: boolean
  loadingProgress: number         // 0–100
  loadingMessage: string
  hasData: boolean
  
  // Actions
  loadZip: (file: File) => Promise<void>
  setSelectedMap: (map: string) => void
  setSelectedMatch: (matchId: string) => void
  setTimelinePosition: (pos: number) => void
  togglePlayback: () => void
  setPlaybackSpeed: (speed: number) => void
  toggleEventType: (event: EventType) => void
  setOverlayMode: (mode: string) => void
}

TYPESCRIPT INTERFACES
typescriptinterface GameEvent {
  userId: string
  matchId: string
  mapId: string
  x: number
  y: number
  z: number
  ts: number          // milliseconds
  event: EventType
  isBot: boolean
  pixelX: number      // pre-computed on parse
  pixelY: number      // pre-computed on parse
  date: string        // 'February_10' etc, from folder
}

type EventType = 
  | 'Position' 
  | 'BotPosition' 
  | 'Kill' 
  | 'Killed' 
  | 'BotKill' 
  | 'BotKilled' 
  | 'KilledByStorm' 
  | 'Loot'

interface Match {
  matchId: string
  mapId: string
  date: string
  humanCount: number
  botCount: number
  killCount: number
  deathCount: number
  lootCount: number
  stormDeathCount: number
  duration: number        // ms — max(ts) - min(ts)
  startTs: number
  endTs: number
}

interface MapConfig {
  scale: number
  originX: number
  originZ: number
}

COMPONENT SPECIFICATIONS

HEADER (48px tall, full width)
[ LILA BLACK / FIELD INTEL ]  [AMBROSE VALLEY] [GRAND RIFT] [LOCKDOWN]  [▲ LOAD DATA / DROP .ZIP]

Left: LILA BLACK in IBM Plex Mono 13px --text-primary, then / separator in --text-muted, then FIELD INTEL in 13px --accent
Center: 3 map tab buttons. Hard rectangle, no radius. Inactive: --bg-surface bg, --border border. Active: --accent bg, black text. On click → updates selectedMap in store
Right: Upload trigger button. Dashed --border border, --text-secondary text. On click → opens file picker. Also accepts drag-and-drop onto the entire window
Bottom border: 1px solid var(--border)


LEFT PANEL (280px wide, full height minus header, scrollable)
Each section:
──────────────────
SECTION LABEL
──────────────────
[content]
Section label: ALL CAPS, 10px, --text-secondary, IBM Plex Mono, letter-spacing 0.1em. 1px --border line above and below.
Section 1 — DATE RANGE

Two date inputs side by side (FROM / TO)
Style: --bg-surface background, --border border, --text-primary text, IBM Plex Mono
Label above each: "FROM" / "TO" in label style
Filter events by the folder date (February_10 etc.)

Section 2 — MATCH

Label: "MATCH ID"
A <select> dropdown showing all available match IDs for the selected map + date range
Each option: truncated match ID (first 8 chars) + player count badge
When a match is selected, all other views filter to that match only
Below: small text showing "N PLAYERS · N BOTS" in --text-secondary

Section 3 — PLAYERS

Label: "PLAYER TYPE"
Two toggle buttons side by side: [HUMANS] [BOTS]
Both can be on simultaneously
Active state: --accent bg, black text
Inactive: --bg-surface bg

Section 4 — EVENTS

Label: "EVENT FILTER"
5 rows, each with a hard square checkbox + color swatch + label:

  [■] ████ POSITION TRAILS
  [■] ████ KILLS
  [■] ████ DEATHS  
  [■] ████ LOOT
  [■] ████ STORM DEATHS

Color swatches: --event-position, --event-kill, --event-death, --event-loot, --event-storm
Default: KILLS, DEATHS, LOOT, STORM DEATHS on. POSITION TRAILS off (too much noise)

Section 5 — OVERLAY

Label: "HEATMAP OVERLAY"
4 options as hard rectangle radio buttons stacked:

  [ NONE          ]
  [ KILL ZONES    ]
  [ DEATH ZONES   ]
  [ PLAYER TRAFFIC]

Selected: --accent left border (3px) + --text-primary text
Unselected: --text-secondary text

Section 6 — MATCH STATS (bottom of panel)

Label: "MATCH SUMMARY"
Grid of stat blocks (2 columns):

  PLAYERS    BOTS
  12         38
  
  KILLS      DEATHS
  24         31
  
  DURATION   MAP
  08:42      AMBROSE

Each block: label in 10px --text-secondary, value in 18px IBM Plex Mono --text-primary
Full width separator line above this section


MAP CANVAS (center, remaining width, full height minus header and timeline)
Built with Leaflet.js using a custom CRS.
javascript// Custom CRS for the 1024x1024 minimap image
const MinimapCRS = L.extend({}, L.CRS.Simple, {
  transformation: new L.Transformation(1, 0, -1, 1024)
})

const map = L.map('map-container', {
  crs: MinimapCRS,
  minZoom: -2,
  maxZoom: 3,
  zoomSnap: 0.5,
  center: [512, 512],
  zoom: 0
})

L.imageOverlay(minimapUrl, [[0, 0], [1024, 1024]]).addTo(map)
Overlaid layers (in z-order, bottom to top):

Minimap image (base)
Subtle grid (CSS, very low opacity --border color)
Heatmap layer (leaflet-heat, conditional)
Position trail polylines (thin, 1px, dimmed)
Event markers (circles/icons)
UI controls (Leaflet controls)

Event Markers:

Kill: orange circle, radius 6, --event-kill fill, black border
Killed / KilledByStorm: red circle, radius 6, --event-death fill
Loot: blue square (rotated 45°, diamond shape), --event-loot fill
BotKill / BotKilled: same as human equivalents but 50% opacity
Position: not rendered as individual markers — only as trails

Position Trails:

Each unique userId in the selected match gets a polyline
Humans: --text-primary at 30% opacity, 1px weight
Bots: --event-position at 20% opacity, 1px weight
Only render positions up to the current timelinePosition

Canvas UI Controls (inside map, top-right):
[+]
[−]
[⊙] RESET
Hard square buttons, --bg-surface bg, --border border, IBM Plex Mono
Legend (inside map, bottom-right):
─────────────
  ● KILL
  ● DEATH
  ◆ LOOT
  ● STORM
─────────────
--bg-surface background with --border border, 10px IBM Plex Mono labels
Empty State (when no data loaded):
[centered in canvas]

NO DATA LOADED

DROP A .ZIP FILE ANYWHERE
OR CLICK "LOAD DATA" ABOVE

─────────────────────────
EXPECTED FORMAT:
player_data.zip containing
February_10/ ... February_14/
minimaps/
README.md
Loading State:
PARSING DATA

[████████████░░░░░░░░] 64%

READING 847 / 1,243 FILES
Progress bar: hard rectangle, --accent fill, --border border

BOTTOM TIMELINE (80px tall, full width minus left panel)
[▶ PLAY] [■ STOP]  ──────────────[■]──────────────  T+ 04:32.881  [0.5×][1×][2×][4×]
Left side — Playback Controls:

[▶ PLAY] and [■ STOP] as hard rectangle buttons
Active state: --accent bg, black text
8px gap between buttons

Center — Scrubber:

Full width minus controls on either side
Track: 1px --border line, full width
Filled portion: --accent color, 2px height
Handle: 10px × 10px hard square, --accent fill, draggable
Tick marks: every 10% of match duration, 4px tall lines, timestamp label below in 9px IBM Plex Mono
Above the scrubber: a mini event density chart (Recharts AreaChart) showing how many events happened at each time segment — uses --event-kill and --event-death colors as stacked areas. This gives the designer a quick view of when fights happened.

Current Time Display:

T+ 04:32.881 in IBM Plex Mono 16px --text-primary, positioned right of scrubber

Right side — Speed Controls:

[0.5×] [1×] [2×] [4×] as a toggle group
Selected: --accent bg, black text
Default: 1×

Playback Logic:
typescript// On each animation frame while playing:
currentTimestamp += deltaMs * playbackSpeed
timelinePosition = (currentTimestamp - match.startTs) / match.duration

// Rendered events = all events where event.ts <= currentTimestamp
// Position trails = all Position events up to currentTimestamp, per user

LOADING / PARSING PIPELINE
This is the most technically complex part. Must work exactly as follows:
typescript// Step 1: User drops/selects ZIP file
async function loadZip(file: File) {
  setLoading(true, 'EXTRACTING ZIP...')
  
  const zip = await JSZip.loadAsync(file)
  
  // Step 2: Extract minimap images
  setLoadingMessage('LOADING MINIMAPS...')
  const minimapFiles = Object.entries(zip.files)
    .filter(([path]) => path.includes('minimaps/'))
  
  for (const [path, zipEntry] of minimapFiles) {
    const blob = await zipEntry.async('blob')
    const url = URL.createObjectURL(blob)
    const mapId = extractMapId(path)  // 'AmbroseValley' etc.
    minimapImages[mapId] = url
  }
  
  // Step 3: Find all parquet files
  const parquetFiles = Object.entries(zip.files)
    .filter(([path]) => path.includes('February_'))
    .filter(([_, entry]) => !entry.dir)
  
  // Step 4: Parse each parquet file
  const allEvents: GameEvent[] = []
  
  for (let i = 0; i < parquetFiles.length; i++) {
    const [path, zipEntry] = parquetFiles[i]
    
    setLoadingProgress((i / parquetFiles.length) * 100)
    setLoadingMessage(`READING ${i + 1} / ${parquetFiles.length} FILES`)
    
    const buffer = await zipEntry.async('arraybuffer')
    const events = await parseParquetFile(buffer, path)
    allEvents.push(...events)
  }
  
  // Step 5: Build match index
  setLoadingMessage('BUILDING MATCH INDEX...')
  const matches = buildMatchIndex(allEvents)
  
  setRawEvents(allEvents)
  setMatches(matches)
  setLoading(false)
  setHasData(true)
}
parseParquetFile must:

Use parquet-wasm to read the buffer
Decode the event column from bytes to string
Determine isBot from user_id (numeric = bot)
Extract date from the file path (February_10 etc.)
Pre-compute pixelX and pixelY using worldToPixel(x, z, mapId) — do this ONCE at parse time, not on every render
Strip .nakama-0 from match_id for display
Return array of GameEvent objects


PERFORMANCE REQUIREMENTS
The dataset has ~89,000 rows. The browser must handle this without freezing.
Required optimizations:

Parse in a Web Worker — parquet parsing blocks the main thread. Use a Worker so the UI stays responsive during loading.
Pre-compute pixel coordinates — never call worldToPixel inside a render loop. Compute once on parse, store on the event object.
Virtualize marker rendering — don't render 89k Leaflet markers. Only render events matching current filters + current timeline position. Use Leaflet's LayerGroup and clear/re-add on filter change.
Downsample Position events for heatmap — Position events are 85%+ of data. For heatmaps, bin into a 64×64 grid and sum counts. Render the grid, not individual points.
Debounce filter changes — debounce filter updates by 150ms to avoid thrashing during slider drag.
Batch Leaflet updates — use map.eachLayer + LayerGroup bulk operations rather than individual addTo(map) calls per marker.


SCREENS TO BUILD
Screen 1: Empty State

Header with map tabs (disabled/dimmed)
Left panel showing empty filter sections with — placeholder values
Canvas showing the empty state message centered
Timeline bar showing zeroed controls (disabled)
Large, centered drop zone overlay text on the canvas

Screen 2: Loading State

Canvas replaced with progress display
Loading message + progress bar
File count display updating in real time

Screen 3: Match Loaded — Event View

Full dashboard populated
Minimap visible with event markers
Left panel showing real match stats
Timeline at position 0, ready to play
KILLS and DEATHS visible by default

Screen 4: Timeline Playing

Same as Screen 3 but PLAY button active (shows ■ STOP)
Position trails visible behind players
Timestamp counting up
Markers appearing progressively

Screen 5: Heatmap Mode

Heatmap overlay visible on map
Event markers reduced/hidden
Heatmap legend visible in canvas corner
Overlay filter showing active selection


DEPLOYMENT
Netlify configuration:
toml# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Embedder-Policy = "require-corp"
    Cross-Origin-Opener-Policy = "same-origin"
The COOP/COEP headers are required for SharedArrayBuffer, which parquet-wasm needs for WebAssembly threading.
package.json scripts:
json{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}

EDGE CASES TO HANDLE

Missing minimap — if a map's minimap image isn't in the ZIP, show a dark placeholder with grid lines and a NO MINIMAP AVAILABLE label
Corrupt parquet file — skip silently, increment counter, continue parsing
Bot-only matches — some match files may only contain bot data. Still show them, just with bot markers only
Single-player matches — valid, show normally
February 14 partial data — no special handling needed, treat like any other day
Match ID display — strip .nakama-0 suffix everywhere in the UI. Show first 8 chars + ... in dropdowns
Timestamp normalization — within a match, normalize timestamps so the first event is always T+ 00:00.000 regardless of the raw ts value
Empty filter results — if filters produce zero events, show NO EVENTS MATCH CURRENT FILTERS centered on the canvas, not a broken empty map


REPOSITORY STRUCTURE
lila-black-field-intel/
├── public/
│   └── favicon.ico
├── src/
│   ├── [all source files as above]
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── netlify.toml
├── package.json
└── README.md
README must include:

Live deployment URL
Tech stack summary
Setup steps (npm install && npm run dev)
How to use the tool (load ZIP, select map, select match, use timeline)
Architecture decisions and trade-offs documented
Known limitations