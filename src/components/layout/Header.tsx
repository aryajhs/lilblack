import { useStore } from '../../store/useStore';
import { MapId } from '../../types';
import { Upload } from 'lucide-react';

const MAP_LABELS: Record<MapId, string> = {
  AmbroseValley: 'AMBROSE VALLEY',
  GrandRift:     'GRAND RIFT',
  Lockdown:      'LOCKDOWN',
};

export function Header() {
  const { selectedMap, setSelectedMap, hasData, isLoading, loadZip, matches } = useStore();

  // Which maps have data available?
  const mapsWithData = new Set(matches.map(m => m.mapId));

  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.zip';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) await loadZip(file);
    };
    input.click();
  };

  return (
    <header
      className="h-12 border-b flex items-center justify-between px-4 flex-shrink-0"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
    >
      {/* Logo / title */}
      <div className="flex items-center gap-2" style={{ fontFamily: 'var(--font-mono)' }}>
        <span className="text-[13px] tracking-[0.05em]" style={{ color: 'var(--text-primary)' }}>
          LILA BLACK
        </span>
        <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>/</span>
        <span className="text-[13px] tracking-[0.05em]" style={{ color: 'var(--accent)' }}>
          FIELD INTEL
        </span>
      </div>

      {/* Map tab buttons */}
      <div className="flex items-center gap-1">
        {(['AmbroseValley', 'GrandRift', 'Lockdown'] as MapId[]).map(map => {
          const isActive   = selectedMap === map;
          const hasMapData = mapsWithData.has(map);
          return (
            <button
              key={map}
              onClick={() => hasData && setSelectedMap(map)}
              disabled={!hasData}
              className="px-4 py-1.5 text-[10px] tracking-[0.1em] border transition-all"
              style={{
                fontFamily:  'var(--font-mono)',
                background:  isActive ? 'var(--accent)' : 'var(--bg-base)',
                color:       isActive ? 'var(--accent-text)' : hasMapData ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                opacity:     !hasData ? 0.4 : 1,
                cursor:      !hasData ? 'not-allowed' : 'pointer',
              }}
            >
              {MAP_LABELS[map]}
              {hasData && hasMapData && !isActive && (
                <span className="ml-1.5" style={{ color: 'var(--accent)', fontSize: '8px' }}>●</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Load data button */}
      <button
        onClick={handleFileSelect}
        disabled={isLoading}
        className="px-4 py-1.5 text-[10px] tracking-[0.1em] border border-dashed flex items-center gap-2 transition-colors hover:border-[var(--border-active)] hover:text-[var(--text-primary)]"
        style={{
          fontFamily:  'var(--font-mono)',
          color:       isLoading ? 'var(--accent)' : 'var(--text-secondary)',
          borderColor: isLoading ? 'var(--accent)' : 'var(--border)',
          cursor:      isLoading ? 'not-allowed' : 'pointer',
        }}
      >
        <Upload size={12} />
        {isLoading ? 'LOADING...' : hasData ? 'RELOAD DATA' : 'LOAD DATA / DROP .ZIP'}
      </button>
    </header>
  );
}
