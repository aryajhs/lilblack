/**
 * Parquet Parser Web Worker
 *
 * Parses parquet files in a separate thread to avoid blocking the main UI thread.
 * Uses parquet-wasm for WebAssembly-based parsing + apache-arrow to read IPC stream.
 * Pre-computes pixel coordinates from world coordinates for rendering performance.
 */

import initWasm, { readParquet } from 'parquet-wasm/esm';
import { tableFromIPC } from 'apache-arrow';
import type { GameEvent, EventType, MapId } from '../types';
import { worldToPixel } from '../lib/coordinates';

// Initialize WASM once at module load time (shared across all messages to this worker)
const initPromise = initWasm().catch((err: unknown) => {
  console.warn('parquet-wasm init failed, will retry inline:', err);
});

interface ParseRequest {
  type: 'parse';
  buffer: ArrayBuffer;
  path: string;
  date: string;
}

self.onmessage = async (e: MessageEvent<ParseRequest>) => {
  const { type, buffer, path, date } = e.data;

  if (type !== 'parse') return;

  const events: GameEvent[] = [];

  try {
    // Ensure WASM is initialized before any call to readParquet
    await initPromise;

    // readParquet returns a parquet-wasm Table object (NOT an Apache Arrow table)
    const wasmTable = readParquet(new Uint8Array(buffer));

    // Convert to Arrow IPC stream bytes, then parse with apache-arrow
    const ipcBytes = wasmTable.intoIPCStream();
    const table = tableFromIPC(ipcBytes);

    const numRows = table.numRows;
    if (numRows === 0) {
      self.postMessage({ type: 'result', events: [], path });
      return;
    }

    // Column-based access is much faster than row-based for large datasets
    const userIdCol   = table.getChild('user_id');
    const matchIdCol  = table.getChild('match_id');
    const mapIdCol    = table.getChild('map_id');
    const xCol        = table.getChild('x');
    const yCol        = table.getChild('y');
    const zCol        = table.getChild('z');
    const tsCol       = table.getChild('ts');
    const eventCol    = table.getChild('event');

    for (let i = 0; i < numRows; i++) {
      try {
        const userId = userIdCol?.get(i)?.toString() ?? '';
        const matchIdRaw = matchIdCol?.get(i)?.toString() ?? '';
        const matchId = matchIdRaw.replace('.nakama-0', '');
        const mapIdRaw = (mapIdCol?.get(i)?.toString() ?? '') as MapId;

        const x = Number(xCol?.get(i)) || 0;
        const y = Number(yCol?.get(i)) || 0;
        const z = Number(zCol?.get(i)) || 0;

        // Timestamps in Arrow may be BigInt (Int64/Timestamp type)
        const tsRaw = tsCol?.get(i);
        const ts = tsRaw != null
          ? (typeof tsRaw === 'bigint' ? Number(tsRaw) : Number(tsRaw))
          : 0;

        // Event column may be binary (Uint8Array) or string
        const eventRaw = eventCol?.get(i);
        let eventType: EventType = 'Position';
        if (eventRaw != null) {
          if (typeof eventRaw === 'string') {
            eventType = eventRaw.trim() as EventType;
          } else if (eventRaw instanceof Uint8Array) {
            eventType = new TextDecoder().decode(eventRaw).trim() as EventType;
          } else {
            eventType = String(eventRaw).trim() as EventType;
          }
        }

        // UUID-formatted user_id → human; pure numeric → bot
        const isBot = !userId.includes('-');

        const { pixelX, pixelY } = worldToPixel(x, z, mapIdRaw);

        events.push({
          userId,
          matchId,
          mapId: mapIdRaw,
          x,
          y,
          z,
          ts,
          event: eventType,
          isBot,
          pixelX,
          pixelY,
          date,
        });
      } catch (rowErr) {
        // Skip malformed rows silently
      }
    }
  } catch (err) {
    console.warn(`Worker: failed to parse ${path}:`, err);
  }

  self.postMessage({ type: 'result', events, path });
};
