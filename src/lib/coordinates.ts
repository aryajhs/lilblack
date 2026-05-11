import { MapConfig, MapId } from '../types';

export const MAP_CONFIG: Record<MapId, MapConfig> = {
  AmbroseValley: { scale: 900, originX: -370, originZ: -473 },
  GrandRift: { scale: 581, originX: -290, originZ: -290 },
  Lockdown: { scale: 1000, originX: -500, originZ: -500 },
};

export function worldToPixel(x: number, z: number, mapId: MapId): { pixelX: number; pixelY: number } {
  const { scale, originX, originZ } = MAP_CONFIG[mapId];
  const u = (x - originX) / scale;
  const v = (z - originZ) / scale;
  const pixelX = u * 1024;
  const pixelY = (1 - v) * 1024;
  return { pixelX, pixelY };
}
