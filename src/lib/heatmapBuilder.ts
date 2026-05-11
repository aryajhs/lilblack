import { GameEvent } from '../types';

export interface HeatmapPoint {
  lat: number;   // Leaflet lat = 1024 - pixelY  (corrects for y-axis flip)
  lng: number;   // Leaflet lng = pixelX
  intensity: number;
}

// Bin events into a 64×64 grid to reduce point count for leaflet-heat
const GRID_SIZE = 64;
const MAP_SIZE  = 1024;

export function buildHeatmapData(events: GameEvent[]): HeatmapPoint[] {
  const grid: number[][] = Array.from({ length: GRID_SIZE }, () =>
    new Array(GRID_SIZE).fill(0)
  );

  const cellSize = MAP_SIZE / GRID_SIZE; // 16 px per cell

  events.forEach(event => {
    const gx = Math.floor(event.pixelX / cellSize);
    const gy = Math.floor(event.pixelY / cellSize);

    if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
      grid[gy][gx]++;
    }
  });

  // Find the peak count for normalisation
  let maxCount = 1;
  grid.forEach(row => row.forEach(n => { if (n > maxCount) maxCount = n; }));

  const points: HeatmapPoint[] = [];

  for (let gy = 0; gy < GRID_SIZE; gy++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      if (grid[gy][gx] === 0) continue;

      const centerPixelX = (gx + 0.5) * cellSize;
      const centerPixelY = (gy + 0.5) * cellSize;

      // Apply the same y-axis flip used for all other Leaflet coordinates:
      //   Leaflet lat = 1024 - pixelY
      points.push({
        lat: 1024 - centerPixelY,
        lng: centerPixelX,
        intensity: grid[gy][gx] / maxCount,
      });
    }
  }

  return points;
}
