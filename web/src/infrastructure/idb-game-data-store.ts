import type { GameDataManifest } from '../domain/game-data/game-data-manifest';
import type { GameDataStore } from '../domain/game-data/game-data-store';

const FILES = 'files';
const META = 'meta';
const MANIFEST_KEY = 'manifest';

const request = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });

export class IdbGameDataStore implements GameDataStore {
  private db: Promise<IDBDatabase> | null = null;

  constructor(private readonly name = 'vangers-game-data') {}

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(this.name, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(FILES);
        req.result.createObjectStore(META);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.db;
  }

  async put(gamePath: string, data: Uint8Array) {
    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const tx = (await this.open()).transaction(FILES, 'readwrite');
    tx.objectStore(FILES).put(buffer, gamePath);
    await done(tx);
  }

  async read(gamePath: string) {
    const tx = (await this.open()).transaction(FILES, 'readonly');
    const buffer = await request<ArrayBuffer | undefined>(tx.objectStore(FILES).get(gamePath));
    if (!buffer) throw new Error(`Game file is missing from the local cache: ${gamePath}`);
    return new Uint8Array(buffer);
  }

  async saveManifest(manifest: GameDataManifest) {
    const tx = (await this.open()).transaction(META, 'readwrite');
    tx.objectStore(META).put(manifest, MANIFEST_KEY);
    await done(tx);
  }

  async loadManifest() {
    const tx = (await this.open()).transaction(META, 'readonly');
    return (await request<GameDataManifest | undefined>(tx.objectStore(META).get(MANIFEST_KEY))) ?? null;
  }

  async clear() {
    const tx = (await this.open()).transaction([FILES, META], 'readwrite');
    tx.objectStore(FILES).clear();
    tx.objectStore(META).clear();
    await done(tx);
  }
}
