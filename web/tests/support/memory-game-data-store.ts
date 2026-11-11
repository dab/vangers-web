import type { GameDataManifest } from '../../src/domain/game-data/game-data-manifest';
import type { GameDataStore } from '../../src/domain/game-data/game-data-store';

export class MemoryGameDataStore implements GameDataStore {
  files = new Map<string, Uint8Array>();
  manifest: GameDataManifest | null = null;

  async put(gamePath: string, data: Uint8Array) {
    this.files.set(gamePath, data);
  }

  async read(gamePath: string) {
    const data = this.files.get(gamePath);
    if (!data) throw new Error(`missing ${gamePath}`);
    return data;
  }

  async saveManifest(manifest: GameDataManifest) {
    this.manifest = manifest;
  }

  async loadManifest() {
    return this.manifest;
  }

  async clear() {
    this.files.clear();
    this.manifest = null;
  }
}
