import { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { EventType } from '../../types';

export function LeftPanel() {
  const {
    matches,
    selectedMap,
    selectedMatchId,
    selectedDates,
    availableDates,
    setSelectedMatch,
    setDateRange,
    showHumans,
    showBots,
    setShowHumans,
    setShowBots,
    activeEvents,
    toggleEventType,
    overlayMode,
    setOverlayMode,
    hasData,
  } = useStore();

  // Helper: is a date folder within the currently selected range?
  const inRange = (date: string) => {
    if (!selectedDates) return true;
    const [from, to] = selectedDates;
    return date >= from && date <= to;
  };

  // Matches visible for the current map + date range
  const filteredMatches = matches.filter(
    m => m.mapId === selectedMap && inRange(m.date)
  );

  const selectedMatch = matches.find(m => m.matchId === selectedMatchId);

  // Auto-select first match whenever the filtered list changes and nothing is selected
  useEffect(() => {
    if (filteredMatches.length > 0 && !filteredMatches.find(m => m.matchId === selectedMatchId)) {
      setSelectedMatch(filteredMatches[0].matchId);
    }
  }, [filteredMatches, selectedMatchId, setSelectedMatch]);

  // ── Event filter groups ──────────────────────────────────────────────────
  const eventGroups: { events: EventType[]; label: string; color: string; antSwatch?: boolean }[] = [
    { events: ['Position', 'BotPosition'], label: 'MARCHING PATHS', color: 'var(--event-position)', antSwatch: true },
    { events: ['Kill', 'BotKill'],         label: 'KILLS',           color: 'var(--event-kill)'     },
    { events: ['Killed', 'BotKilled'],     label: 'DEATHS',          color: 'var(--event-death)'    },
    { events: ['Loot'],                    label: 'LOOT',            color: 'var(--event-loot)'     },
    { events: ['KilledByStorm'],           label: 'STORM DEATHS',    color: 'var(--event-storm)'    },
  ];

  const isGroupActive = (group: EventType[]) => group.some(e => activeEvents.has(e));

  const toggleGroup = (group: EventType[]) => {
    const active = isGroupActive(group);
    group.forEach(ev => {
      const has = activeEvents.has(ev);
      if (active && has)   toggleEventType(ev);  // turn off
      if (!active && !has) toggleEventType(ev);  // turn on
    });
  };

  const fmtDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <div
      className="w-[280px] h-full overflow-y-auto border-r flex-shrink-0"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
    >

      {/* ── DATE RANGE ──────────────────────────────────────────────────── */}
      <Section title="DATE RANGE">
        <div className="grid grid-cols-2 gap-2">
          {(['FROM', 'TO'] as const).map((label, idx) => (
            <div key={label}>
              <div className="mb-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
                {label}
              </div>
              <select
                value={selectedDates?.[idx] ?? ''}
                disabled={!hasData || availableDates.length === 0}
                onChange={e => {
                  const val = e.target.value;
                  if (idx === 0) {
                    setDateRange([val, selectedDates?.[1] ?? availableDates[availableDates.length - 1] ?? val]);
                  } else {
                    setDateRange([selectedDates?.[0] ?? availableDates[0] ?? val, val]);
                  }
                }}
                className="w-full px-2 py-1 text-[10px] border"
                style={{
                  fontFamily:  'var(--font-mono)',
                  background:  'var(--bg-base)',
                  color:       'var(--text-primary)',
                  borderColor: 'var(--border)',
                  opacity: !hasData ? 0.4 : 1,
                }}
              >
                {availableDates.length === 0
                  ? <option value="">—</option>
                  : availableDates.map(d => (
                      <option key={d} value={d}>{d.replace('_', ' ')}</option>
                    ))
                }
              </select>
            </div>
          ))}
        </div>
      </Section>

      {/* ── MATCH ───────────────────────────────────────────────────────── */}
      <Section title="MATCH">
        <div
          className="text-[10px] tracking-[0.1em] mb-2"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
        >
          MATCH ID
        </div>
        <select
          value={selectedMatchId ?? ''}
          onChange={e => setSelectedMatch(e.target.value || null)}
          disabled={!hasData || filteredMatches.length === 0}
          className="w-full px-2 py-1.5 text-[11px] border"
          style={{
            fontFamily:  'var(--font-mono)',
            background:  'var(--bg-base)',
            color:       'var(--text-primary)',
            borderColor: 'var(--border)',
            opacity: !hasData ? 0.4 : 1,
          }}
        >
          {filteredMatches.length === 0 ? (
            <option value="">— NO MATCHES —</option>
          ) : (
            filteredMatches.map(m => (
              <option key={m.matchId} value={m.matchId}>
                {m.matchId.substring(0, 8)}…  ({m.humanCount + m.botCount} players)
              </option>
            ))
          )}
        </select>
        {selectedMatch && (
          <div
            className="text-[10px] mt-1.5"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
          >
            {selectedMatch.humanCount} PLAYERS · {selectedMatch.botCount} BOTS
          </div>
        )}
      </Section>

      {/* ── PLAYER TYPE ─────────────────────────────────────────────────── */}
      <Section title="PLAYERS">
        <div className="flex gap-2">
          {[
            { label: 'HUMANS', active: showHumans, toggle: () => setShowHumans(!showHumans) },
            { label: 'BOTS',   active: showBots,   toggle: () => setShowBots(!showBots)     },
          ].map(({ label, active, toggle }) => (
            <button
              key={label}
              onClick={toggle}
              disabled={!hasData}
              className="flex-1 px-3 py-1.5 text-[10px] tracking-[0.1em] border"
              style={{
                fontFamily:  'var(--font-mono)',
                background:  active ? 'var(--accent)' : 'var(--bg-base)',
                color:       active ? 'var(--accent-text)' : 'var(--text-secondary)',
                borderColor: active ? 'var(--accent)' : 'var(--border)',
                opacity:     !hasData ? 0.4 : 1,
                cursor:      !hasData ? 'not-allowed' : 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      {/* ── EVENT FILTER ────────────────────────────────────────────────── */}
      <Section title="EVENT FILTER">
        <div className="space-y-2">
          {eventGroups.map(({ events, label, color, antSwatch }) => {
            const active = isGroupActive(events);
            return (
              <label
                key={label}
                className="flex items-center gap-2 cursor-pointer group select-none"
                style={{ opacity: !hasData ? 0.4 : 1 }}
              >
                {/* Hard-square checkbox */}
                <div
                  onClick={() => hasData && toggleGroup(events)}
                  className="w-4 h-4 border flex items-center justify-center flex-shrink-0"
                  style={{
                    background:  active ? 'var(--accent)' : 'var(--bg-base)',
                    borderColor: active ? 'var(--accent)' : 'var(--border)',
                    cursor: hasData ? 'pointer' : 'not-allowed',
                  }}
                >
                  {active && (
                    <div className="w-2 h-2" style={{ background: 'var(--accent-text)' }} />
                  )}
                </div>
                {/* Colour swatch (animated bar for path trails) */}
                {antSwatch ? (
                  <div
                    className="event-filter-swatch-ants w-8 h-3 border flex-shrink-0 overflow-hidden"
                    style={{ borderColor: 'var(--border)' }}
                  />
                ) : (
                  <div
                    className="w-8 h-3 border flex-shrink-0"
                    style={{ background: color, borderColor: 'var(--border)' }}
                  />
                )}
                <span
                  className="text-[10px] tracking-[0.08em] group-hover:text-[var(--text-primary)] transition-colors"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: active ? 'var(--event-position)' : 'var(--text-secondary)',
                    textShadow: active ? '0 0 12px color-mix(in srgb, var(--event-position) 45%, transparent)' : 'none',
                  }}
                >
                  {label}
                </span>
              </label>
            );
          })}
        </div>
      </Section>

      {/* ── HEATMAP OVERLAY ─────────────────────────────────────────────── */}
      <Section title="HEATMAP OVERLAY">
        <div className="space-y-0.5">
          {([
            { mode: 'none'    as const, label: 'NONE'          },
            { mode: 'kill'    as const, label: 'KILL ZONES'    },
            { mode: 'death'   as const, label: 'DEATH ZONES'   },
            { mode: 'traffic' as const, label: 'PLAYER TRAFFIC'},
          ]).map(({ mode, label }) => {
            const selected = overlayMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setOverlayMode(mode)}
                disabled={!hasData}
                className="w-full text-left px-3 py-1.5 text-[10px] tracking-[0.1em] transition-colors"
                style={{
                  fontFamily:  'var(--font-mono)',
                  color:       selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderLeft:  selected ? '3px solid var(--accent)' : '3px solid transparent',
                  background:  selected ? 'var(--bg-elevated)' : 'transparent',
                  opacity:     !hasData ? 0.4 : 1,
                  cursor:      !hasData ? 'not-allowed' : 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── MATCH SUMMARY ───────────────────────────────────────────────── */}
      {selectedMatch && (
        <Section title="MATCH SUMMARY">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <StatBlock label="PLAYERS"  value={selectedMatch.humanCount} />
            <StatBlock label="BOTS"     value={selectedMatch.botCount}   />
            <StatBlock label="KILLS"    value={selectedMatch.killCount}  />
            <StatBlock label="DEATHS"   value={selectedMatch.deathCount} />
            <StatBlock label="LOOT"     value={selectedMatch.lootCount}  />
            <StatBlock label="STORM ✝"  value={selectedMatch.stormDeathCount} />
            <StatBlock
              label="DURATION"
              value={fmtDuration(selectedMatch.duration)}
            />
            <StatBlock
              label="MAP"
              value={selectedMatch.mapId === 'AmbroseValley' ? 'AMBROSE' :
                     selectedMatch.mapId === 'GrandRift'     ? 'GRAND RIFT' :
                     selectedMatch.mapId.toUpperCase()}
            />
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Helper sub-components ──────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b py-3 px-4" style={{ borderColor: 'var(--border)' }}>
      <div
        className="text-[10px] tracking-[0.1em] mb-3 pb-2 border-b"
        style={{
          fontFamily:  'var(--font-mono)',
          color:       'var(--text-secondary)',
          borderColor: 'var(--border)',
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div
        className="text-[10px] tracking-[0.1em]"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
      >
        {label}
      </div>
      <div
        className="mt-0.5 tabular-nums"
        style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', color: 'var(--text-primary)' }}
      >
        {value}
      </div>
    </div>
  );
}
