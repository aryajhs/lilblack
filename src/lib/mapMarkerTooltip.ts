import type { GameEvent } from '../types';
import { escapeHtml, playerShortId } from './playerLabel';

/** Compact numeric string for world coords (parquet floats). */
function fmtCoord(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Object.is(n, -0)) return '0';
  const rounded = Math.round(n * 1000) / 1000;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

function formatEventTime(ts: number): string {
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return '—';
  }
}

function combatHeadline(ev: GameEvent): string {
  switch (ev.event) {
    case 'Kill':
    case 'BotKill':
      return 'Elimination';
    case 'Killed':
    case 'BotKilled':
      return 'Combat death';
    case 'KilledByStorm':
      return 'Storm / zone death';
    default:
      return ev.event;
  }
}

export type MarkerTooltipRole = 'loot' | 'combat' | 'path_end';

/**
 * Rich HTML for Leaflet `bindTooltip` on map markers. All dynamic text is escaped.
 */
export function buildMapMarkerTooltipHtml(ev: GameEvent, role: MarkerTooltipRole): string {
  const isBot = ev.isBot;
  const kind = isBot ? 'BOT' : 'HUMAN';
  const sid = escapeHtml(playerShortId(ev.userId));

  const headline =
    role === 'path_end'
      ? 'March path — current point'
      : role === 'loot'
        ? 'Loot pickup'
        : combatHeadline(ev);

  const px = Math.round(ev.pixelX);
  const py = Math.round(ev.pixelY);
  const x = fmtCoord(ev.x);
  const y = fmtCoord(ev.y);
  const z = fmtCoord(ev.z);
  const worldMissing = ev.x === 0 && ev.y === 0 && ev.z === 0;
  const worldNote = worldMissing
    ? '<span class="map-event-player-tooltip__muted"> World X/Y/Z are 0 — likely missing in source row.</span>'
    : '';

  const mapId = escapeHtml(ev.mapId || '—');
  const timeStr = escapeHtml(formatEventTime(ev.ts));
  const day = ev.date ? escapeHtml(ev.date) : '';

  const dayLine = day
    ? `<span class="map-event-player-tooltip__k">Session day</span><span class="map-event-player-tooltip__v">${day}</span>`
    : '';

  return (
    `<div class="map-event-player-tooltip">` +
    `<span class="map-event-player-tooltip__kind map-event-player-tooltip__kind--${isBot ? 'bot' : 'human'}">${kind}</span>` +
    `<span class="map-event-player-tooltip__id">${sid}</span>` +
    `<span class="map-event-player-tooltip__headline">${escapeHtml(headline)}</span>` +
    `<div class="map-event-player-tooltip__kv">` +
    `<span class="map-event-player-tooltip__k">World</span>` +
    `<span class="map-event-player-tooltip__v">X ${escapeHtml(x)} · Y ${escapeHtml(y)} · Z ${escapeHtml(z)}${worldNote}</span>` +
    `<span class="map-event-player-tooltip__k">Minimap</span>` +
    `<span class="map-event-player-tooltip__v">${px}, ${py} px</span>` +
    `<span class="map-event-player-tooltip__k">Map id</span>` +
    `<span class="map-event-player-tooltip__v">${mapId}</span>` +
    `<span class="map-event-player-tooltip__k">Event time</span>` +
    `<span class="map-event-player-tooltip__v">${timeStr}</span>` +
    dayLine +
    `</div>` +
    `</div>`
  );
}
