import { normalizePath } from '../domain/game-data/game-data-manifest';
import type { ImportSource } from '../domain/game-data/import-source';

export interface PickedFile {
  path: string;
  file: Blob;
}

export function filesSource(picked: PickedFile[]): ImportSource {
  const files = picked.map((p) => ({ path: normalizePath(p.path), file: p.file }));
  return {
    async list() {
      return files.map((f) => ({ path: f.path, size: f.file.size }));
    },
    async *entries(wanted) {
      for (const f of files) {
        if (wanted.has(f.path)) yield { path: f.path, data: new Uint8Array(await f.file.arrayBuffer()) };
      }
    },
  };
}

export function filesFromPicker(files: Iterable<File>): PickedFile[] {
  return [...files].map((file) => ({ path: file.webkitRelativePath || file.name, file }));
}

const readBatch = (reader: FileSystemDirectoryReader) =>
  new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));

const readFile = (entry: FileSystemFileEntry) =>
  new Promise<File>((resolve, reject) => entry.file(resolve, reject));

async function walk(entry: FileSystemEntry, out: PickedFile[]): Promise<void> {
  if (entry.isFile) {
    out.push({ path: normalizePath(entry.fullPath), file: await readFile(entry as FileSystemFileEntry) });
    return;
  }
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  for (let batch = await readBatch(reader); batch.length > 0; batch = await readBatch(reader)) {
    for (const child of batch) await walk(child, out);
  }
}

export async function filesFromDrop(entries: FileSystemEntry[]): Promise<PickedFile[]> {
  const out: PickedFile[] = [];
  for (const entry of entries) await walk(entry, out);
  return out;
}
