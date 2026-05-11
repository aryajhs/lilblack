import JSZip from 'jszip';

export interface ZipContents {
  parquetFiles: Array<{ path: string; buffer: ArrayBuffer; date: string }>;
  minimapImages: Record<string, string>;
}

export async function loadZipFile(
  file: File,
  onProgress: (loaded: number, total: number, message: string) => void
): Promise<ZipContents> {
  onProgress(0, 100, 'EXTRACTING ZIP...');

  const zip = await JSZip.loadAsync(file);

  onProgress(20, 100, 'LOADING MINIMAPS...');

  const minimapImages: Record<string, string> = {};
  const minimapEntries = Object.entries(zip.files).filter(([path]) =>
    path.includes('minimaps/')
  );

  for (const [path, zipEntry] of minimapEntries) {
    if (!zipEntry.dir) {
      const blob = await zipEntry.async('blob');
      const url = URL.createObjectURL(blob);
      const mapId = extractMapIdFromPath(path);
      if (mapId) {
        minimapImages[mapId] = url;
      }
    }
  }

  onProgress(40, 100, 'FINDING PARQUET FILES...');

  const parquetEntries = Object.entries(zip.files).filter(
    ([path, entry]) =>
      path.includes('February_') && !entry.dir && path.endsWith('.nakama-0')
  );

  const parquetFiles: Array<{ path: string; buffer: ArrayBuffer; date: string }> = [];

  for (let i = 0; i < parquetEntries.length; i++) {
    const [path, zipEntry] = parquetEntries[i];
    const buffer = await zipEntry.async('arraybuffer');
    const date = extractDateFromPath(path);

    parquetFiles.push({ path, buffer, date });

    const progress = 40 + Math.floor((i / parquetEntries.length) * 60);
    onProgress(progress, 100, `EXTRACTED ${i + 1} / ${parquetEntries.length} FILES`);
  }

  return { parquetFiles, minimapImages };
}

function extractMapIdFromPath(path: string): string | null {
  if (path.includes('AmbroseValley')) return 'AmbroseValley';
  if (path.includes('GrandRift')) return 'GrandRift';
  if (path.includes('Lockdown')) return 'Lockdown';
  return null;
}

function extractDateFromPath(path: string): string {
  const match = path.match(/February_(\d+)/);
  return match ? `February_${match[1]}` : 'Unknown';
}
