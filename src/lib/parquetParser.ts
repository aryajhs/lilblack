/**
 * Main-thread parquet parser (fallback — prefer the Web Worker version).
 * Uses parquet-wasm ESM + apache-arrow tableFromIPC.
 */

import initWasm, { readParquet } from 'parquet-wasm/esm';
import { tableFromIPC } from 'apache-arrow';
import { GameEvent, EventType, MapId } from '../types';
import { worldToPixel } from './coordinates';

let wasmReady: Promise<void> | null = null;

function ensureWasm(): Promise<void> {
  if (!wasmReady) wasmReady = initWasm().then(() => undefined);
  return wasmReady;
}

export async function parseParquetFile(
  buffer: ArrayBuffer,
  path: string,
  date: string
): Promise<GameEvent[]> {
  await ensureWasm();

  const events: GameEvent[] = [];

  try {
    const wasmTable = readParquet(new Uint8Array(buffer));
    const ipcBytes  = wasmTable.intoIPCStream();
    const table     = tableFromIPC(ipcBytes);

    const numRows    = table.numRows;
    const userIdCol  = table.getChild('user_id');
    const matchIdCol = table.getChild('match_id');
    const mapIdCol   = table.getChild('map_id');
    const xCol       = table.getChild('x');
    const yCol       = table.getChild('y');
    const zCol       = table.getChild('z');
    const tsCol      = table.getChild('ts');
    const eventCol   = table.getChild('event');

    for (let i = 0; i < numRows; i++) {
      try {
        const userId    = userIdCol?.get(i)?.toString()  ?? '';
        const matchIdRaw = matchIdCol?.get(i)?.toString() ?? '';
        const matchId   = matchIdRaw.replace('.nakama-0', '');
        const mapIdRaw  = (mapIdCol?.get(i)?.toString()  ?? '') as MapId;

        const x = Number(xCol?.get(i)) || 0;
        const y = Number(yCol?.get(i)) || 0;
        const z = Number(zCol?.get(i)) || 0;

        const tsRaw = tsCol?.get(i);
        const ts = tsRaw != null
          ? (typeof tsRaw === 'bigint' ? Number(tsRaw) : Number(tsRaw))
          : 0;

        const eventRaw = eventCol?.get(i);
        let eventType: EventType = 'Position';
        if (eventRaw != null) {
          if (typeof eventRaw === 'string')         eventType = eventRaw.trim()                                  as EventType;
          else if (eventRaw instanceof Uint8Array)  eventType = new TextDecoder().decode(eventRaw).trim()        as EventType;
          else                                      eventType = String(eventRaw).trim()                          as EventType;
        }

        const isBot = !userId.includes('-');
        const { pixelX, pixelY } = worldToPixel(x, z, mapIdRaw);

        events.push({ userId, matchId, mapId: mapIdRaw, x, y, z, ts, event: eventType, isBot, pixelX, pixelY, date });
      } catch {
        // skip bad rows
      }
    }
  } catch (err) {
    console.warn(`parseParquetFile: failed to parse ${path}:`, err);
  }

  return events;
}
