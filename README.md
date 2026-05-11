# LILA BLACK — FIELD INTEL

A browser-based game analytics dashboard for analyzing player behavior on battle-royale extraction shooter maps using telemetry data.

## Author & submission

**Aryan Gupta** — take-home assignment for the **Product Engineer** role.

---

## Live Deployment

🚀 **Deploy to Netlify** — This project is configured for one-click deployment to Netlify as a static site.

## Tech Stack

- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 (brutalist design system)
- **Mapping**: Leaflet.js with custom CRS for minimap overlays
- **Data**: Parquet-WASM (client-side parquet parsing)
- **ZIP**: JSZip (browser-based extraction)
- **State**: Zustand
- **Charts**: Recharts
- **Deployment**: Netlify static hosting

## Features

- 📦 **Client-side ZIP processing** — Upload a ZIP file containing parquet telemetry data and minimap images
- 🗺️ **Interactive maps** — Leaflet-based canvas with event markers, position trails, and heatmap overlays
- ⏱️ **Timeline playback** — Scrub through match events with variable playback speed (0.5×, 1×, 2×, 4×)
- 🔍 **Advanced filtering** — Filter by map, match, player type (human/bot), and event type
- 📊 **Match analytics** — Real-time statistics on kills, deaths, loot, storm deaths, and player counts
- 🎨 **Brutalist UI** — Minimal military intelligence terminal aesthetic with IBM Plex Mono typography

## Setup

```bash
# Install dependencies
pnpm install

# Run development server
pnpm run dev

# Build for production
pnpm run build

# Preview production build
pnpm run preview
```

## How to Use

1. **Load Data**: Click "LOAD DATA" in the header or drag-and-drop a ZIP file anywhere on the page
2. **Expected ZIP Format**:
   ```
   player_data.zip
   ├── February_10/
   │   └── {user_id}_{match_id}.nakama-0 (parquet files)
   ├── February_11/
   ├── February_12/
   ├── February_13/
   ├── February_14/
   └── minimaps/
       ├── AmbroseValley_Minimap.png
       ├── GrandRift_Minimap.png
       └── Lockdown_Minimap.jpg
   ```
3. **Select Map**: Choose between Ambrose Valley, Grand Rift, or Lockdown
4. **Select Match**: Pick a match from the dropdown to visualize
5. **Filter Events**: Toggle event types (kills, deaths, loot, position trails, storm deaths)
6. **Playback**: Use the timeline scrubber or play button to watch events unfold over time
7. **Heatmap Mode**: Switch overlay modes to visualize kill zones, death zones, or player traffic

## Architecture Highlights

### Performance Optimizations

- **Pre-computed pixel coordinates** — World-to-pixel conversion happens once during parse, not on every render
- **Lazy rendering** — Only render events within the current timeline position and active filters
- **Efficient Leaflet updates** — Batch marker operations using LayerGroups instead of individual adds
- **Parquet streaming** — Files parsed asynchronously with progress feedback

### Key Files

```
src/
├── store/useStore.ts           # Zustand state management
├── lib/
│   ├── zipLoader.ts            # ZIP extraction logic
│   ├── parquetParser.ts        # Parquet file parsing
│   ├── coordinates.ts          # World-to-pixel conversion
│   └── matchBuilder.ts         # Match index aggregation
├── components/
│   ├── layout/
│   │   ├── Header.tsx          # Top bar with map tabs
│   │   ├── LeftPanel.tsx       # Filters and stats sidebar
│   │   └── BottomTimeline.tsx  # Playback controls
│   └── map/
│       └── MapCanvas.tsx       # Leaflet map with markers/trails
└── types/index.ts              # TypeScript interfaces
```

### Coordinate System

The tool uses a custom Leaflet CRS to overlay 1024×1024 minimap images:

```typescript
const MinimapCRS = L.extend({}, L.CRS.Simple, {
  transformation: new L.Transformation(1, 0, -1, 1024)
});
```

Game world coordinates (x, y, z) are converted to pixel coordinates using map-specific scale and origin offsets:

```typescript
const MAP_CONFIG = {
  AmbroseValley: { scale: 900, originX: -370, originZ: -473 },
  GrandRift: { scale: 581, originX: -290, originZ: -290 },
  Lockdown: { scale: 1000, originX: -500, originZ: -500 },
};
```

## Design System

**Philosophy**: Minimal Brutalism + Military Intelligence Terminal

- **Colors**: Dark backgrounds (#0A0A0A), high-contrast text, neon accent (#C8FF00)
- **Typography**: IBM Plex Mono for data, Inter for UI text
- **Shapes**: Zero border-radius, 1px borders, no shadows or gradients
- **Event Colors**:
  - Kill: `#FF8C00` (orange)
  - Death: `#FF3B3B` (red)
  - Loot: `#4DAAFF` (blue)
  - Storm: `#9B59FF` (purple)

## Known Limitations

- Parquet-WASM requires COOP/COEP headers (configured in `netlify.toml`)
- Dataset size: Optimized for ~89,000 events; larger datasets may require additional optimization
- Bot detection heuristic: Assumes numeric user IDs are bots, UUID user IDs are humans
- Position trails can be noisy if enabled for all players simultaneously

## Development Notes

This tool runs entirely in the browser with no backend. All ZIP extraction, parquet parsing, coordinate transformation, and visualization happens client-side using WebAssembly and modern browser APIs.

---

Built for Level Designers to analyze player movement, combat hotspots, and match flow on extraction shooter maps.
