import '../styles/index.css';
import { useState, useCallback } from 'react';
import { Header } from '../components/layout/Header';
import { LeftPanel } from '../components/layout/LeftPanel';
import { BottomTimeline } from '../components/layout/BottomTimeline';
import { MapCanvas } from '../components/map/MapCanvas';
import { useStore } from '../store/useStore';

export default function App() {
  const { loadZip, isLoading } = useStore();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear when leaving the root element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isLoading) return;

    const zipFile = Array.from(e.dataTransfer.files).find(f =>
      f.name.toLowerCase().endsWith('.zip')
    );
    if (zipFile) await loadZip(zipFile);
  }, [loadZip, isLoading]);

  return (
    <div
      className="w-screen h-screen flex flex-col overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ background: 'var(--bg-base)' }}
    >
      <Header />

      <div className="flex flex-1 overflow-hidden min-h-0">
        <LeftPanel />
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <MapCanvas />
          <BottomTimeline />
        </div>
      </div>

      {/* Full-screen drag-over overlay */}
      {isDragging && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-[9999]"
          style={{
            background: 'rgba(10, 10, 10, 0.92)',
            border: '3px dashed var(--accent)',
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <div
              className="text-[24px] tracking-[0.15em]"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}
            >
              DROP .ZIP FILE HERE
            </div>
            <div
              className="text-[11px] tracking-[0.08em]"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
            >
              RELEASE TO LOAD TELEMETRY DATA
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
