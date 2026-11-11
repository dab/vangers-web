import { describe, expect, it } from 'vitest';
import { importGameData } from '../../src/application/import-game-data';
import type { ImportSource } from '../../src/domain/game-data/import-source';
import { MemoryGameDataStore } from '../support/memory-game-data-store';

const bytes = (text: string) => new TextEncoder().encode(text);

function fakeSource(files: Record<string, string>): ImportSource {
  return {
    async list() {
      return Object.entries(files).map(([path, text]) => ({ path, size: bytes(text).length }));
    },
    async *entries(wanted) {
      for (const [path, text] of Object.entries(files)) {
        if (wanted.has(path)) yield { path, data: bytes(text) };
      }
    },
  };
}

const gameFolder = {
  'Vangers/vangers.exe': 'MZ',
  'Vangers/data/worlds.prm': 'w',
  'Vangers/data/car.prm': 'cc',
  'Vangers/data/item.prm': 'iii',
  'Vangers/data/vangers64.pdb': 'debug',
  'Vangers/data/resource/video/intro.avi': 'video',
};

describe('importGameData', () => {
  it('stores game files under their game path and saves the manifest', async () => {
    const store = new MemoryGameDataStore();
    const result = await importGameData(fakeSource(gameFolder), store, () => {});
    expect(result.ok).toBe(true);
    expect([...store.files.keys()].sort()).toEqual(
      ['car.prm', 'item.prm', 'resource/video/intro.avi', 'worlds.prm'].sort(),
    );
    expect(new TextDecoder().decode(store.files.get('car.prm'))).toBe('cc');
    expect(store.manifest?.files).toHaveLength(4);
  });

  it('reports byte progress up to the total', async () => {
    const progress: number[] = [];
    const result = await importGameData(fakeSource(gameFolder), new MemoryGameDataStore(), (done, total) => {
      progress.push(done / total);
    });
    expect(result.ok).toBe(true);
    expect(progress.at(-1)).toBe(1);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
  });

  it('rejects a wrong folder without touching existing data', async () => {
    const store = new MemoryGameDataStore();
    await importGameData(fakeSource(gameFolder), store, () => {});
    const result = await importGameData(fakeSource({ 'Photos/cat.jpg': 'x' }), store, () => {});
    expect(result).toEqual({ ok: false, error: { kind: 'not-game-data', missing: ['worlds.prm', 'car.prm', 'item.prm'] } });
    expect(store.files.has('car.prm')).toBe(true);
  });

  it('replaces previously imported data', async () => {
    const store = new MemoryGameDataStore();
    await importGameData(fakeSource({ ...gameFolder, 'Vangers/data/old.txt': 'old' }), store, () => {});
    await importGameData(fakeSource(gameFolder), store, () => {});
    expect(store.files.has('old.txt')).toBe(false);
  });

  it('leaves no partial data behind when reading the source fails', async () => {
    const store = new MemoryGameDataStore();
    const broken: ImportSource = {
      list: fakeSource(gameFolder).list,
      async *entries() {
        yield { path: 'Vangers/data/worlds.prm', data: bytes('w') };
        throw new Error('disk unplugged');
      },
    };
    await expect(importGameData(broken, store, () => {})).rejects.toThrow('disk unplugged');
    expect(store.files.size).toBe(0);
    expect(store.manifest).toBeNull();
  });
});
