import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildManifest } from '../../src/domain/game-data/game-data-manifest';
import { IdbGameDataStore } from '../../src/infrastructure/idb-game-data-store';

let dbName = '';
let counter = 0;
beforeEach(() => {
  dbName = `vangers-test-${counter++}`;
});

const manifest = () => {
  const result = buildManifest(['worlds.prm', 'car.prm', 'item.prm'].map((path) => ({ path, size: 1 })));
  if (!result.ok) throw new Error('fixture');
  return result.manifest;
};

describe('IdbGameDataStore', () => {
  it('round-trips file bytes, including views into larger buffers', async () => {
    const store = new IdbGameDataStore(dbName);
    const backing = new Uint8Array([9, 9, 1, 2, 3, 9]);
    await store.put('car.prm', backing.subarray(2, 5));
    expect([...(await store.read('car.prm'))]).toEqual([1, 2, 3]);
  });

  it('keeps data and manifest across store instances (page reloads)', async () => {
    const first = new IdbGameDataStore(dbName);
    await first.put('car.prm', new Uint8Array([7]));
    await first.saveManifest(manifest());
    const second = new IdbGameDataStore(dbName);
    expect(await second.loadManifest()).toEqual(manifest());
    expect([...(await second.read('car.prm'))]).toEqual([7]);
  });

  it('has no manifest before the first import', async () => {
    expect(await new IdbGameDataStore(dbName).loadManifest()).toBeNull();
  });

  it('clears files and manifest', async () => {
    const store = new IdbGameDataStore(dbName);
    await store.put('car.prm', new Uint8Array([7]));
    await store.saveManifest(manifest());
    await store.clear();
    expect(await store.loadManifest()).toBeNull();
    await expect(store.read('car.prm')).rejects.toThrow(/car\.prm/);
  });
});
