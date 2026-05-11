export type EventType =
  | 'Position'
  | 'BotPosition'
  | 'Kill'
  | 'Killed'
  | 'BotKill'
  | 'BotKilled'
  | 'KilledByStorm'
  | 'Loot';

export type MapId = 'AmbroseValley' | 'GrandRift' | 'Lockdown';

export type OverlayMode = 'none' | 'kill' | 'death' | 'traffic';

export interface GameEvent {
  userId: string;
  matchId: string;
  mapId: string;
  x: number;
  y: number;
  z: number;
  ts: number;
  event: EventType;
  isBot: boolean;
  pixelX: number;
  pixelY: number;
  date: string;
}

export interface Match {
  matchId: string;
  mapId: string;
  date: string;
  humanCount: number;
  botCount: number;
  killCount: number;
  deathCount: number;
  lootCount: number;
  stormDeathCount: number;
  duration: number;
  startTs: number;
  endTs: number;
}

export interface MapConfig {
  scale: number;
  originX: number;
  originZ: number;
}

export type PlaybackSpeed = 0.5 | 1 | 2 | 4;
