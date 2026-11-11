import type { GameDataManifest } from './game-data-manifest';

export interface GameDataStore {
  put(gamePath: string, data: Uint8Array): Promise<void>;
  read(gamePath: string): Promise<Uint8Array>;
  saveManifest(manifest: GameDataManifest): Promise<void>;
  loadManifest(): Promise<GameDataManifest | null>;
  clear(): Promise<void>;
}
