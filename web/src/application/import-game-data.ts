import { buildManifest, type ManifestResult } from '../domain/game-data/game-data-manifest';
import type { GameDataStore } from '../domain/game-data/game-data-store';
import type { ImportSource } from '../domain/game-data/import-source';

export type ImportProgress = (doneBytes: number, totalBytes: number) => void;

export async function importGameData(
  source: ImportSource,
  store: GameDataStore,
  onProgress: ImportProgress,
): Promise<ManifestResult> {
  const result = buildManifest(await source.list());
  if (!result.ok) return result;

  const { manifest } = result;
  const gamePathBySource = new Map(manifest.files.map((f) => [f.sourcePath, f.gamePath]));
  await store.clear();
  try {
    let doneBytes = 0;
    onProgress(0, manifest.totalBytes);
    for await (const entry of source.entries(new Set(gamePathBySource.keys()))) {
      const gamePath = gamePathBySource.get(entry.path);
      if (gamePath === undefined) continue;
      await store.put(gamePath, entry.data);
      doneBytes += entry.data.byteLength;
      onProgress(Math.min(doneBytes, manifest.totalBytes), manifest.totalBytes);
    }
    await store.saveManifest(manifest);
  } catch (error) {
    await store.clear();
    throw error;
  }
  return result;
}
