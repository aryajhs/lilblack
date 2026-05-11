import { create } from 'zustand';
import { GameEvent, Match, MapId, EventType, OverlayMode, PlaybackSpeed } from '../types';
import { loadZipFile } from '../lib/zipLoader';
import { buildMatchIndex } from '../lib/matchBuilder';

interface AppState {
  rawEvents: GameEvent[];
  matches: Match[];
  minimapImages: Record<string, string>;

  selectedMap: MapId;
  selectedMatchId: string | null;
  selectedDates: [string, string] | null;
  showHumans: boolean;
  showBots: boolean;
  activeEvents: Set<EventType>;
  overlayMode: OverlayMode;

  timelinePosition: number;
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;
  matchDuration: number;
  currentTimestamp: number;

  isLoading: boolean;
  loadingProgress: number;
  loadingMessage: string;
  hasData: boolean;

  availableDates: string[];

  loadZip: (file: File) => Promise<void>;
  setSelectedMap: (map: MapId) => void;
  setSelectedMatch: (matchId: string | null) => void;
  setDateRange: (dates: [string, string] | null) => void;
  setTimelinePosition: (pos: number) => void;
  togglePlayback: () => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  toggleEventType: (event: EventType) => void;
  setOverlayMode: (mode: OverlayMode) => void;
  setShowHumans: (show: boolean) => void;
  setShowBots: (show: boolean) => void;
  updatePlayback: (deltaMs: number) => void;
}

export const useStore = create<AppState>((set, get) => ({
  rawEvents: [],
  matches: [],
  minimapImages: {},

  selectedMap: 'AmbroseValley',
  selectedMatchId: null,
  selectedDates: null,
  showHumans: true,
  showBots: true,
  activeEvents: new Set<EventType>(['Kill', 'Killed', 'BotKill', 'BotKilled', 'Loot', 'KilledByStorm']),
  overlayMode: 'none',

  timelinePosition: 0,
  isPlaying: false,
  playbackSpeed: 1,
  matchDuration: 0,
  currentTimestamp: 0,

  isLoading: false,
  loadingProgress: 0,
  loadingMessage: '',
  hasData: false,

  availableDates: [],

  loadZip: async (file: File) => {
    set({ isLoading: true, loadingProgress: 0, loadingMessage: 'STARTING...' });

    try {
      const { parquetFiles, minimapImages } = await loadZipFile(
        file,
        (progress, total, message) => {
          set({ loadingProgress: progress, loadingMessage: message });
        }
      );

      set({ loadingMessage: 'PARSING PARQUET FILES...' });

      const allEvents: GameEvent[] = [];
      const workers: Worker[] = [];
      const maxWorkers = Math.min(navigator.hardwareConcurrency || 4, 4);

      let completedFiles = 0;

      // Edge case: no parquet files found, skip the worker pool
      if (parquetFiles.length === 0) {
        set({ loadingMessage: 'NO PARQUET FILES FOUND', loadingProgress: 100 });
      } else {
        await new Promise<void>((resolve, reject) => {
          let nextFileIndex = 0;
          let hasRejected = false;

          const processFile = (worker: Worker) => {
            if (nextFileIndex >= parquetFiles.length) {
              return;
            }

            const fileIndex = nextFileIndex++;
            const { buffer, path, date } = parquetFiles[fileIndex];

            worker.postMessage(
              {
                type: 'parse',
                buffer,
                path,
                date,
              },
              [buffer]
            );
          };

          for (let i = 0; i < maxWorkers; i++) {
            const worker = new Worker(new URL('../workers/parquet.worker.ts', import.meta.url), {
              type: 'module',
            });

            worker.onmessage = (e: MessageEvent) => {
              const { events } = e.data;
              allEvents.push(...events);
              completedFiles++;

              const progress = Math.floor((completedFiles / parquetFiles.length) * 100);
              set({
                loadingProgress: progress,
                loadingMessage: `PARSING ${completedFiles} / ${parquetFiles.length} FILES`,
              });

              if (completedFiles === parquetFiles.length) {
                workers.forEach(w => w.terminate());
                resolve();
              } else {
                processFile(worker);
              }
            };

            worker.onerror = (error) => {
              console.error('Worker error:', error);
              // On worker error, mark this file as "completed" so we don't hang
              completedFiles++;
              if (!hasRejected && completedFiles === parquetFiles.length) {
                workers.forEach(w => w.terminate());
                resolve();
              } else if (nextFileIndex < parquetFiles.length) {
                processFile(worker);
              }
            };

            workers.push(worker);
            processFile(worker);
          }
        });
      }

      set({ loadingMessage: 'BUILDING MATCH INDEX...' });
      const matches = buildMatchIndex(allEvents);

      const uniqueDates = Array.from(new Set(allEvents.map(e => e.date))).sort();

      set({
        rawEvents: allEvents,
        matches,
        minimapImages,
        availableDates: uniqueDates,
        selectedDates: uniqueDates.length >= 2 ? [uniqueDates[0], uniqueDates[uniqueDates.length - 1]] : null,
        isLoading: false,
        hasData: true,
        loadingProgress: 100,
        selectedMatchId: matches.length > 0 ? matches[0].matchId : null,
        selectedMap: matches.length > 0 ? (matches[0].mapId as MapId) : 'AmbroseValley',
      });

      if (matches.length > 0) {
        const firstMatch = matches[0];
        set({
          matchDuration: firstMatch.duration,
          currentTimestamp: firstMatch.startTs,
        });
      }
    } catch (error) {
      console.error('Failed to load ZIP:', error);
      set({ isLoading: false, loadingMessage: 'ERROR LOADING DATA' });
    }
  },

  setSelectedMap: (map: MapId) => {
    set({ selectedMap: map, selectedMatchId: null, timelinePosition: 0, isPlaying: false });
  },

  setSelectedMatch: (matchId: string | null) => {
    const state = get();
    const match = state.matches.find(m => m.matchId === matchId);

    if (match) {
      set({
        selectedMatchId: matchId,
        selectedMap: match.mapId as MapId,
        matchDuration: match.duration,
        currentTimestamp: match.startTs,
        timelinePosition: 0,
        isPlaying: false,
      });
    } else {
      set({ selectedMatchId: matchId });
    }
  },

  setDateRange: (dates: [string, string] | null) => {
    set({ selectedDates: dates, selectedMatchId: null, timelinePosition: 0, isPlaying: false });
  },

  setTimelinePosition: (pos: number) => {
    const state = get();
    const match = state.matches.find(m => m.matchId === state.selectedMatchId);
    if (match) {
      const newTimestamp = match.startTs + pos * match.duration;
      set({ timelinePosition: pos, currentTimestamp: newTimestamp });
    }
  },

  togglePlayback: () => {
    set(state => ({ isPlaying: !state.isPlaying }));
  },

  setPlaybackSpeed: (speed: PlaybackSpeed) => {
    set({ playbackSpeed: speed });
  },

  toggleEventType: (event: EventType) => {
    set(state => {
      const newActiveEvents = new Set(state.activeEvents);
      if (newActiveEvents.has(event)) {
        newActiveEvents.delete(event);
      } else {
        newActiveEvents.add(event);
      }
      return { activeEvents: newActiveEvents };
    });
  },

  setOverlayMode: (mode: OverlayMode) => {
    set({ overlayMode: mode });
  },

  setShowHumans: (show: boolean) => {
    set({ showHumans: show });
  },

  setShowBots: (show: boolean) => {
    set({ showBots: show });
  },

  updatePlayback: (deltaMs: number) => {
    const state = get();
    if (!state.isPlaying) return;

    const match = state.matches.find(m => m.matchId === state.selectedMatchId);
    if (!match) return;

    const newTimestamp = state.currentTimestamp + deltaMs * state.playbackSpeed;

    if (newTimestamp >= match.endTs) {
      set({
        currentTimestamp: match.endTs,
        timelinePosition: 1,
        isPlaying: false,
      });
    } else {
      const newPosition = (newTimestamp - match.startTs) / match.duration;
      set({
        currentTimestamp: newTimestamp,
        timelinePosition: Math.max(0, Math.min(1, newPosition)),
      });
    }
  },
}));