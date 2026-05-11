import { useEffect, useRef, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet.heat';
import { useStore } from '../../store/useStore';
import { GameEvent } from '../../types';
import { buildHeatmapData } from '../../lib/heatmapBuilder';

// The Leaflet custom CRS uses transformation (1, 0, -1, 1024):
//   screen_x = lng
//   screen_y = -lat + 1024
//
// The minimap image is 1024×1024 with origin at top-left.
// worldToPixel returns pixelY where 0 = image-top, 1024 = image-bottom.
// For Leaflet to render a marker at the correct screen position:
//   screen_y must equal pixelY  →  -lat + 1024 = pixelY  →  lat = 1024 - pixelY
//
// Therefore every marker/polyline coord must use [1024 - pixelY, pixelX].
const toLatLng = (pixelX: number, pixelY: number): [number, number] =>
  [1024 - pixelY, pixelX];

declare module 'leaflet' {
  function heatLayer(
    latlngs: Array<[number, number, number]>,
    options?: Record<string, unknown>
  ): L.Layer;
}

export function MapCanvas() {
  const mapRef              = useRef<L.Map | null>(null);
  const mapContainerRef     = useRef<HTMLDivElement>(null);
  const imageLayerRef       = useRef<L.ImageOverlay | null>(null);
  const markersLayerRef     = useRef<L.LayerGroup | null>(null);
  const trailsLayerRef      = useRef<L.LayerGroup | null>(null);
  const heatmapLayerRef     = useRef<L.Layer | null>(null);
  const markerUpdateTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const heatmapUpdateTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const {
    selectedMap,
    minimapImages,
    rawEvents,
    selectedMatchId,
    currentTimestamp,
    activeEvents,
    showHumans,
    showBots,
    overlayMode,
    hasData,
    isLoading,
    loadingMessage,
    loadingProgress,
  } = useStore();

  // ─── 1. Initialise Leaflet map once ────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const MinimapCRS = L.extend({}, L.CRS.Simple, {
      transformation: new L.Transformation(1, 0, -1, 1024),
    });

    const map = L.map(mapContainerRef.current, {
      crs: MinimapCRS,
      minZoom: -2,
      maxZoom: 3,
      zoomSnap: 0.5,
      center: [512, 512],
      zoom: 0,
      zoomControl: false,
      attributionControl: false,
    });

    mapRef.current     = map;
    markersLayerRef.current = L.layerGroup().addTo(map);
    trailsLayerRef.current  = L.layerGroup().addTo(map);

    // Custom zoom control buttons styled to match brutalist design system
    L.control.zoom({ position: 'topright' }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ─── 2. Swap minimap image when map selection changes ─────────────────────
  useEffect(() => {
    if (!mapRef.current) return;

    if (imageLayerRef.current) {
      mapRef.current.removeLayer(imageLayerRef.current);
      imageLayerRef.current = null;
    }

    const imageUrl = minimapImages[selectedMap];
    if (imageUrl) {
      // Bounds: [[southLat, westLng], [northLat, eastLng]]
      // With our CRS, lat=0→bottom, lat=1024→top; so image bottom = lat 0, top = lat 1024.
      const overlay = L.imageOverlay(imageUrl, [[0, 0], [1024, 1024]]).addTo(mapRef.current);
      imageLayerRef.current = overlay;

      // Fit the map view to the image bounds
      mapRef.current.fitBounds([[0, 0], [1024, 1024]]);
    }
  }, [selectedMap, minimapImages]);

  // ─── 3. Rebuild markers & trails (debounced 150 ms) ───────────────────────
  const rebuildMarkers = useCallback(() => {
    if (!mapRef.current || !markersLayerRef.current || !trailsLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    trailsLayerRef.current.clearLayers();

    if (!selectedMatchId) return;

    const matchEvents = rawEvents.filter(e => e.matchId === selectedMatchId);

    // ── Event markers (kills / deaths / loot / storm) ──────────────────────
    const markerEvents = matchEvents.filter(
      e =>
        e.ts <= currentTimestamp &&
        e.event !== 'Position' &&
        e.event !== 'BotPosition' &&
        activeEvents.has(e.event) &&
        ((e.isBot && showBots) || (!e.isBot && showHumans))
    );

    markerEvents.forEach(event => {
      const isBot = event.isBot;
      const opacity = isBot ? 0.78 : 1;
      const fillOpacity = isBot ? 0.82 : 1;
      const [lat, lng] = toLatLng(event.pixelX, event.pixelY);

      if (event.event === 'Loot') {
        const icon = L.divIcon({
          className: `loot-marker${isBot ? ' loot-marker--bot' : ''}`,
          html: '<div class="loot-marker-shape" aria-hidden="true"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        L.marker([lat, lng], { icon, opacity }).addTo(markersLayerRef.current!);
      } else {
        let fillColor: string;
        let markerClass: string;
        if (event.event === 'Kill' || event.event === 'BotKill') {
          fillColor = 'var(--event-kill)';
          markerClass = 'event-marker event-marker--kill';
        } else if (event.event === 'Killed' || event.event === 'BotKilled') {
          fillColor = 'var(--event-death)';
          markerClass = 'event-marker event-marker--death';
        } else {
          fillColor = 'var(--event-storm)';
          markerClass = 'event-marker event-marker--storm';
        }
        if (isBot) markerClass += ' event-marker--bot';

        L.circleMarker([lat, lng], {
          className: markerClass,
          radius: isBot ? 7 : 9,
          fillColor,
          color: '#0a0a0a',
          weight: 2,
          opacity,
          fillOpacity,
        }).addTo(markersLayerRef.current!);
      }
    });

    // ── Position trails ─────────────────────────────────────────────────────
    const showTrails =
      activeEvents.has('Position') || activeEvents.has('BotPosition');

    if (showTrails) {
      const playerPaths: Record<string, GameEvent[]> = {};

      matchEvents
        .filter(
          e =>
            (e.event === 'Position' || e.event === 'BotPosition') &&
            e.ts <= currentTimestamp &&
            ((e.isBot && showBots) || (!e.isBot && showHumans))
        )
        .forEach(ev => {
          if (!playerPaths[ev.userId]) playerPaths[ev.userId] = [];
          playerPaths[ev.userId].push(ev);
        });

      Object.values(playerPaths).forEach(path => {
        if (path.length < 2) return;
        const sorted = path.sort((a, b) => a.ts - b.ts);
        const coords = sorted.map(e => toLatLng(e.pixelX, e.pixelY) as [number, number]);

        const isBot = sorted[0].isBot;
        L.polyline(coords, {
          color: isBot ? 'var(--event-position-bot)' : 'var(--event-position)',
          weight: isBot ? 2 : 2.5,
          opacity: isBot ? 0.55 : 0.92,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: '10 14',
          className: isBot ? 'map-trail map-trail--bot' : 'map-trail map-trail--human',
        }).addTo(trailsLayerRef.current!);
      });
    }
  }, [selectedMatchId, currentTimestamp, activeEvents, showHumans, showBots, rawEvents]);

  useEffect(() => {
    clearTimeout(markerUpdateTimeout.current);
    markerUpdateTimeout.current = setTimeout(rebuildMarkers, 150);
    return () => clearTimeout(markerUpdateTimeout.current);
  }, [rebuildMarkers]);

  // ─── 4. Heatmap overlay (debounced 200 ms) ─────────────────────────────────
  const rebuildHeatmap = useCallback(() => {
    if (!mapRef.current) return;

    if (heatmapLayerRef.current) {
      mapRef.current.removeLayer(heatmapLayerRef.current);
      heatmapLayerRef.current = null;
    }

    if (overlayMode === 'none' || !selectedMatchId) return;

    const matchEvents = rawEvents.filter(e => e.matchId === selectedMatchId);
    let heatEvents: GameEvent[] = [];

    if (overlayMode === 'kill') {
      heatEvents = matchEvents.filter(
        e =>
          (e.event === 'Kill' || e.event === 'BotKill') &&
          e.ts <= currentTimestamp &&
          ((e.isBot && showBots) || (!e.isBot && showHumans))
      );
    } else if (overlayMode === 'death') {
      heatEvents = matchEvents.filter(
        e =>
          (e.event === 'Killed' || e.event === 'BotKilled' || e.event === 'KilledByStorm') &&
          e.ts <= currentTimestamp &&
          ((e.isBot && showBots) || (!e.isBot && showHumans))
      );
    } else if (overlayMode === 'traffic') {
      heatEvents = matchEvents.filter(
        e =>
          (e.event === 'Position' || e.event === 'BotPosition') &&
          e.ts <= currentTimestamp &&
          ((e.isBot && showBots) || (!e.isBot && showHumans))
      );
    }

    if (heatEvents.length === 0) return;

    // buildHeatmapData already returns corrected [lat, lng] with 1024-y flip
    const heatPoints = buildHeatmapData(heatEvents).map(
      p => [p.lat, p.lng, p.intensity] as [number, number, number]
    );

    const heatBase = {
      radius: 46,
      blur: 20,
      maxZoom: 3,
      // Lower max = same bin counts read as "hotter"; minOpacity lifts faint areas
      max: 0.58,
      minOpacity: 0.18,
    };

    const gradients: Record<'kill' | 'death' | 'traffic', Record<number, string>> = {
      kill: {
        0.05: 'rgba(255, 180, 60, 0.35)',
        0.25: 'rgba(255, 150, 20, 0.72)',
        0.45: 'rgba(255, 110, 0, 0.88)',
        0.65: 'rgba(255, 70, 0, 0.92)',
        0.85: 'rgba(255, 35, 20, 0.96)',
        1.0: 'rgba(255, 15, 0, 1)',
      },
      death: {
        0.05: 'rgba(200, 120, 255, 0.38)',
        0.28: 'rgba(255, 80, 140, 0.75)',
        0.48: 'rgba(255, 50, 90, 0.88)',
        0.68: 'rgba(255, 40, 60, 0.93)',
        0.88: 'rgba(220, 20, 50, 0.97)',
        1.0: 'rgba(180, 0, 40, 1)',
      },
      traffic: {
        0.05: 'rgba(0, 220, 255, 0.4)',
        0.22: 'rgba(0, 200, 255, 0.78)',
        0.42: 'rgba(0, 255, 200, 0.86)',
        0.62: 'rgba(120, 255, 80, 0.9)',
        0.82: 'rgba(255, 255, 40, 0.94)',
        1.0: 'rgba(255, 120, 40, 1)',
      },
    };

    const layer = (L as any).heatLayer(heatPoints, {
      ...heatBase,
      gradient: gradients[overlayMode],
    });
    layer.addTo(mapRef.current);
    heatmapLayerRef.current = layer;
  }, [overlayMode, selectedMatchId, currentTimestamp, showHumans, showBots, rawEvents]);

  useEffect(() => {
    clearTimeout(heatmapUpdateTimeout.current);
    heatmapUpdateTimeout.current = setTimeout(rebuildHeatmap, 200);
    return () => clearTimeout(heatmapUpdateTimeout.current);
  }, [rebuildHeatmap]);

  // ─── 5. Derived state for overlay messages ─────────────────────────────────
  const noEventsVisible = useMemo(() => {
    if (!hasData || isLoading || !selectedMatchId) return false;
    const matchEvents = rawEvents.filter(e => e.matchId === selectedMatchId);
    const visible = matchEvents.filter(
      e =>
        e.ts <= currentTimestamp &&
        activeEvents.has(e.event) &&
        ((e.isBot && showBots) || (!e.isBot && showHumans))
    );
    return visible.length === 0 && currentTimestamp > 0;
  }, [hasData, isLoading, selectedMatchId, rawEvents, currentTimestamp, activeEvents, showHumans, showBots]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 relative" style={{ background: 'var(--bg-base)', minHeight: 0 }}>

      {/* Empty state */}
      {!hasData && !isLoading && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center z-[1000] pointer-events-none"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
        >
          <div className="text-[14px] tracking-[0.1em] mb-4" style={{ color: 'var(--accent)' }}>
            NO DATA LOADED
          </div>
          <div className="text-[11px] tracking-[0.05em] mb-6">
            DROP A .ZIP FILE ANYWHERE
            <br />
            OR CLICK &quot;LOAD DATA&quot; ABOVE
          </div>
          <div
            className="border-t w-72 pt-4 mt-2 text-[10px] space-y-1"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <div className="tracking-[0.05em]">EXPECTED FORMAT:</div>
            <div>player_data.zip containing</div>
            <div>February_10/ ... February_14/</div>
            <div>minimaps/  ·  README.md</div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center z-[1000]"
          style={{ background: 'var(--bg-base)', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}
        >
          <div className="text-[12px] tracking-[0.15em] mb-8" style={{ color: 'var(--accent)' }}>
            PARSING DATA
          </div>
          <div
            className="w-80 border relative overflow-hidden"
            style={{ borderColor: 'var(--border)', height: '20px' }}
          >
            <div
              className="h-full transition-all duration-200"
              style={{ background: 'var(--accent)', width: `${loadingProgress}%` }}
            />
          </div>
          <div className="text-[11px] mt-3" style={{ color: 'var(--text-secondary)' }}>
            {loadingMessage}
          </div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
            {loadingProgress.toFixed(0)}%
          </div>
        </div>
      )}

      {/* No match selected */}
      {hasData && !selectedMatchId && !isLoading && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center z-[1000] pointer-events-none"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
        >
          <div className="text-[14px] tracking-[0.1em] mb-3">NO MATCH SELECTED</div>
          <div className="text-[10px] tracking-[0.05em]">SELECT A MATCH FROM THE LEFT PANEL</div>
        </div>
      )}

      {/* No events match filters */}
      {noEventsVisible && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center z-[900] pointer-events-none"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
        >
          <div className="text-[13px] tracking-[0.1em] mb-2">NO EVENTS MATCH CURRENT FILTERS</div>
          <div className="text-[10px] tracking-[0.05em]">
            ADJUST EVENT FILTERS OR SCRUB TIMELINE FORWARD
          </div>
        </div>
      )}

      {/* Leaflet map container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* In-map legend */}
      {hasData && (
        <div
          className="absolute bottom-4 right-4 border px-3 py-2 space-y-1.5 z-[500]"
          style={{
            background: 'var(--bg-surface)',
            borderColor: 'var(--border)',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
          }}
        >
          <LegendRow kind="kill"  label="KILL"  />
          <LegendRow kind="death" label="DEATH" />
          <LegendRow kind="loot"  label="LOOT"  />
          <LegendRow kind="storm" label="STORM" />
        </div>
      )}
    </div>
  );
}

function LegendRow({ kind, label }: { kind: 'kill' | 'death' | 'loot' | 'storm'; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {kind === 'loot' ? (
        <div className="map-legend-swatch map-legend-swatch--loot flex-shrink-0" aria-hidden />
      ) : (
        <div className={`map-legend-swatch map-legend-swatch--${kind} flex-shrink-0`} aria-hidden />
      )}
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
}
