# Three insights from building FIELD INTEL

These are **patterns the tool is designed to surface** when you load real telemetry ZIPs and explore matches. They are framed so a **level designer** can connect what they see in the UI to layout and pacing decisions—not as guaranteed facts about every build.

---

## Insight 1 — Combat heat does not spread evenly across the map

**What caught my eye**  
With **heatmap → KILL ZONES** (or death overlay) enabled, dense color rarely tiles the whole minimap; it **clumps** into a handful of blobs that persist as you scrub the timeline, instead of smearing everywhere players walk.

**Back it up**  
The app aggregates **Kill** / **BotKill** (and death variants) into `leaflet.heat` from the same `pixelX`/`pixelY` pipeline as markers. When multiple scrub windows keep highlighting the **same screen region**, that is a **spatial concentration** signal—not just “people were in match,” but “eliminations kept occurring near this footprint.” Match summary totals (`killCount`, `deathCount`) give magnitude; the heat layer gives **where**.

**Actionable?**  
**Yes (indirect).**  
- **Metrics to watch:** death density per hectare (design-time heat export), average engagement range in those cells, time-to-die after first contact in hotspot vs elsewhere.  
- **Actions:** review sightlines/cover height in top 3 heat blobs; add break-up geometry or flanking routes; verify audio/occlusion so fights don’t always collapse to one choke.  
- **Designer care:** hotspots are where **pacing compresses**—players meet faster than the rest of the map intends; either lean into it as a “arena” POI or redistribute attraction so other regions get mid-game relevance.

---

## Insight 2 — Bots and humans occupy different “shapes” when you filter them

**What caught my eye**  
Toggling **HUMANS** vs **BOTS** (and the cyan vs magenta ring encoding on markers) often changes **which neighborhoods light up** for the same event types—not only density.

**Back it up**  
`isBot` is derived from `user_id` shape (see `ARCHITECTURE.md`). The UI filters the **same** `rawEvents` stream; any visible redistribution is therefore **behavioral**, not an artifact of separate datasets. Marching paths (`Position` / `BotPosition`) make this especially obvious: polylines simplify to different **corridors** and **loopiness** when only one population remains.

**Actionable?**  
**Yes.**  
- **Metrics:** path entropy, mean turn rate, time spent in open vs urban mask (if you add masks), bot-human encounter rate per POI.  
- **Actions:** if bots overuse a designer-intended “safe lane,” tune navmesh incentives or encounter tables; if humans avoid a signature POI, revisit reward visibility or early-game bus paths.  
- **Designer care:** bots are often used to **pressure server fill**; if their spatial signature diverges too far from humans, playtests lie about rotation pressure and loot economy.

---

## Insight 3 — Storm deaths are a first-class signal, not “noise deaths”

**What caught my eye**  
`KilledByStorm` is its own event type (purple marker / filter). When you isolate storm deaths and scrub, many dots sit in patterns that **track the shrinking playable ring** implied by time—clusters that move or recur at map edges.

**Back it up**  
The parser preserves `KilledByStorm` separately from `Killed` / `BotKilled`. Match summary exposes **`stormDeathCount`** next to combat deaths. Comparing **storm vs combat death counts** per match is one line in the left panel; pairing that with **where** on the minimap shows whether players are dying to **geometry + zone** (trapped ridges, bad bridges) vs raw DPS.

**Actionable?**  
**Yes.**  
- **Metrics:** storm death per exit distance to next safe compound, median “last safe zone” overlap with low-cover tiles.  
- **Actions:** add secondary egress on ridges that show repeated storm deaths; widen timing windows on one-way drops; rebalance vehicle spawns if edge deaths correlate with long rotations.  
- **Designer care:** storm deaths are often **layout readability** problems—players understood the fight but not the **macro rotation**; fixing that preserves skill expression without buffing guns.

---

### How to use this doc with the tool

1. Load the provided `player_data.zip`.  
2. Pick a high-bot or high-human match from the dropdown.  
3. Cycle **heatmap overlays** and **event filters** while scrubbing.  
4. Cross-check counts in **MATCH SUMMARY** with spatial clumps on the map.

If a claim here fails on your build, treat it as a **hypothesis template**: the UI is built to falsify or support it quickly.
