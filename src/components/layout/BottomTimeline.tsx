import { useEffect, useRef, useMemo, useCallback } from 'react';
import { Play, Square, RotateCcw } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PlaybackSpeed } from '../../types';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts';

export function BottomTimeline() {
  const {
    timelinePosition,
    isPlaying,
    playbackSpeed,
    currentTimestamp,
    selectedMatchId,
    matches,
    rawEvents,
    togglePlayback,
    setPlaybackSpeed,
    setTimelinePosition,
    updatePlayback,
    hasData,
  } = useStore();

  const lastFrameRef = useRef<number>(Date.now());
  const rafRef       = useRef<number | undefined>(undefined);

  const selectedMatch = matches.find(m => m.matchId === selectedMatchId);

  // ─── Event-density buckets for the Recharts strip above the scrubber ───────
  const densityData = useMemo(() => {
    if (!selectedMatch) return [];

    const matchEvents = rawEvents.filter(e => e.matchId === selectedMatchId);
    const NUM_BUCKETS = 50;
    const bucketSize  = selectedMatch.duration / NUM_BUCKETS;

    const buckets = Array.from({ length: NUM_BUCKETS }, (_, i) => ({
      t: i,
      kills: 0,
      deaths: 0,
    }));

    matchEvents.forEach(ev => {
      const elapsed = ev.ts - selectedMatch.startTs;
      const idx = Math.min(Math.floor(elapsed / bucketSize), NUM_BUCKETS - 1);
      if (idx >= 0) {
        if (ev.event === 'Kill'   || ev.event === 'BotKill')    buckets[idx].kills++;
        if (ev.event === 'Killed' || ev.event === 'BotKilled')  buckets[idx].deaths++;
      }
    });

    return buckets;
  }, [selectedMatch, selectedMatchId, rawEvents]);

  // ─── Playback animation loop ───────────────────────────────────────────────
  const animate = useCallback(() => {
    const now  = Date.now();
    const delta = now - lastFrameRef.current;
    lastFrameRef.current = now;
    updatePlayback(delta);
    rafRef.current = requestAnimationFrame(animate);
  }, [updatePlayback]);

  useEffect(() => {
    if (isPlaying) {
      lastFrameRef.current = Date.now();
      rafRef.current = requestAnimationFrame(animate);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, animate]);

  // ─── Reset timeline to beginning ──────────────────────────────────────────
  const handleReset = () => {
    if (selectedMatch) {
      setTimelinePosition(0);
      if (isPlaying) togglePlayback();
    }
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimelinePosition(parseFloat(e.target.value));
  };

  // ─── Timestamp display: T+ MM:SS.mmm ─────────────────────────────────────
  const formatTs = (ms: number): string => {
    if (!selectedMatch) return 'T+ 00:00.000';
    const elapsed    = Math.max(0, ms - selectedMatch.startTs);
    const totalSec   = Math.floor(elapsed / 1000);
    const minutes    = Math.floor(totalSec / 60);
    const seconds    = totalSec % 60;
    const millis     = elapsed % 1000;
    return `T+ ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  };

  const disabled = !hasData || !selectedMatch;

  return (
    <div
      className="border-t flex flex-col"
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--border)',
        height: '92px',
        minHeight: '92px',
        flexShrink: 0,
      }}
    >
      {/* Event density strip (Recharts) — high contrast vs bg-base */}
      {selectedMatch && densityData.length > 0 && (
        <div
          className="timeline-density-strip"
          style={{
            height: '40px',
            flexShrink: 0,
            background: 'linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-base) 100%)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={densityData} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
              <defs>
                <linearGradient id="timeline-g-kill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff9f1a" stopOpacity={0.95} />
                  <stop offset="55%" stopColor="#ff9f1a" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#ff9f1a" stopOpacity={0.22} />
                </linearGradient>
                <linearGradient id="timeline-g-death" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff4d5e" stopOpacity={0.92} />
                  <stop offset="55%" stopColor="#ff4d5e" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#ff4d5e" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis hide domain={[0, 'auto']} />
              {/* Deaths drawn first so kill peaks read on top; not stacked — avoids muddy brown blend */}
              <Area
                type="monotone"
                dataKey="deaths"
                stroke="#ff4d5e"
                strokeWidth={1.25}
                strokeOpacity={1}
                fill="url(#timeline-g-death)"
                fillOpacity={1}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="kills"
                stroke="#ff9f1a"
                strokeWidth={1.5}
                strokeOpacity={1}
                fill="url(#timeline-g-kill)"
                fillOpacity={1}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Controls row */}
      <div className="flex-1 flex items-center gap-3 px-4">

        {/* Primary CTA: run / stop match simulation */}
        <button
          type="button"
          onClick={togglePlayback}
          disabled={disabled}
          title={disabled ? 'Load data and select a match first' : isPlaying ? 'Stop the simulation' : 'Run the match timeline forward from the scrubber'}
          aria-label={isPlaying ? 'Stop simulation' : 'Simulate match — runs the timeline forward'}
          className={`border flex items-center gap-2 flex-shrink-0 text-left min-w-[148px] pl-2.5 pr-3 py-1.5 transition-[box-shadow,transform] duration-150 ${
            !disabled && !isPlaying ? 'timeline-simulate-cta timeline-simulate-cta--pulse' : ''
          }`}
          style={{
            fontFamily: 'var(--font-mono)',
            background: disabled
              ? 'var(--bg-elevated)'
              : isPlaying
                ? 'var(--bg-base)'
                : 'var(--accent)',
            color: disabled
              ? 'var(--text-muted)'
              : isPlaying
                ? 'var(--accent)'
                : 'var(--accent-text)',
            borderColor: disabled ? 'var(--border)' : 'var(--accent)',
            opacity: disabled ? 0.45 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxShadow:
              !disabled && !isPlaying
                ? '0 0 0 1px #00000040 inset'
                : !disabled && isPlaying
                  ? '0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent) inset'
                  : undefined,
          }}
        >
          {isPlaying ? (
            <>
              <Square size={12} fill="currentColor" className="flex-shrink-0" aria-hidden />
              <span className="flex flex-col leading-tight">
                <span className="text-[10px] tracking-[0.12em] font-semibold">STOP</span>
                <span className="text-[8px] tracking-[0.04em] opacity-80 font-normal">SIMULATION RUNNING</span>
              </span>
            </>
          ) : (
            <>
              <Play size={14} fill="currentColor" className="flex-shrink-0" aria-hidden />
              <span className="flex flex-col leading-tight">
                <span className="text-[11px] tracking-[0.14em] font-semibold">SIMULATE</span>
                <span className="text-[8px] tracking-[0.05em] opacity-90 font-normal max-w-[11rem]">
                  CLICK HERE — runs match clock forward
                </span>
              </span>
            </>
          )}
        </button>

        {/* Reset */}
        <button
          onClick={handleReset}
          disabled={disabled}
          className="px-2 py-1.5 border text-[10px] flex items-center gap-1 flex-shrink-0"
          style={{
            fontFamily:  'var(--font-mono)',
            background:  'var(--bg-surface)',
            color:       'var(--text-secondary)',
            borderColor: 'var(--border)',
            opacity:     disabled ? 0.4 : 1,
            cursor:      disabled ? 'not-allowed' : 'pointer',
          }}
          title="Reset to beginning"
        >
          <RotateCcw size={10} />
        </button>

        {/* Scrubber */}
        <div className="flex-1 relative min-w-0">
          <input
            type="range"
            min="0"
            max="1"
            step="0.0001"
            value={timelinePosition}
            onChange={handleScrub}
            disabled={disabled}
            className="w-full cursor-pointer"
            style={{
              background: `linear-gradient(to right, var(--accent) ${timelinePosition * 100}%, var(--border) ${timelinePosition * 100}%)`,
              opacity: disabled ? 0.4 : 1,
              cursor:  disabled ? 'not-allowed' : 'pointer',
            }}
          />
        </div>

        {/* Current time */}
        <div
          className="text-[13px] flex-shrink-0 min-w-[140px] text-right tabular-nums"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}
        >
          {formatTs(currentTimestamp)}
        </div>

        {/* Speed toggles */}
        <div className="flex gap-1 flex-shrink-0">
          {([0.5, 1, 2, 4] as PlaybackSpeed[]).map(spd => (
            <button
              key={spd}
              onClick={() => setPlaybackSpeed(spd)}
              disabled={!hasData}
              className="px-2.5 py-1.5 border text-[10px] tracking-[0.05em]"
              style={{
                fontFamily:  'var(--font-mono)',
                background:  playbackSpeed === spd ? 'var(--accent)' : 'var(--bg-surface)',
                color:       playbackSpeed === spd ? 'var(--accent-text)' : 'var(--text-secondary)',
                borderColor: 'var(--border)',
                opacity:     !hasData ? 0.4 : 1,
                cursor:      !hasData ? 'not-allowed' : 'pointer',
              }}
            >
              {spd}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
