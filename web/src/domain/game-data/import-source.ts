import type { SourceFile } from './game-data-manifest';

export interface SourceEntry {
  path: string;
  data: Uint8Array;
}

// A place the player's game files come from: a picked folder, a dropped folder or a zip.
export interface ImportSource {
  list(): Promise<SourceFile[]>;
  entries(wanted: ReadonlySet<string>): AsyncIterable<SourceEntry>;
}
