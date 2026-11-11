import { describe, expect, it } from 'vitest';
import { filesFromDrop, filesFromPicker, filesSource } from '../../src/infrastructure/files-source';

const file = (name: string, text: string, relativePath = '') => {
  const f = new File([text], name);
  Object.defineProperty(f, 'webkitRelativePath', { value: relativePath });
  return f;
};

describe('filesSource', () => {
  it('lists normalized paths with sizes and reads only wanted files', async () => {
    const source = filesSource([
      { path: 'data\\car.prm', file: file('car.prm', 'car') },
      { path: 'data/item.prm', file: file('item.prm', 'items') },
    ]);
    expect(await source.list()).toEqual([
      { path: 'data/car.prm', size: 3 },
      { path: 'data/item.prm', size: 5 },
    ]);
    const read: string[] = [];
    for await (const entry of source.entries(new Set(['data/item.prm']))) {
      read.push(`${entry.path}=${new TextDecoder().decode(entry.data)}`);
    }
    expect(read).toEqual(['data/item.prm=items']);
  });
});

describe('filesFromPicker', () => {
  it('uses the relative path of a picked folder', () => {
    const picked = filesFromPicker([file('car.prm', 'x', 'data/car.prm'), file('a.wav', 'y', 'data/resource/a.wav')]);
    expect(picked.map((p) => p.path)).toEqual(['data/car.prm', 'data/resource/a.wav']);
  });
});

type FakeEntry = FakeFile | FakeDir;
interface FakeFile {
  isFile: true;
  isDirectory: false;
  name: string;
  fullPath: string;
  file(ok: (f: File) => void): void;
}
interface FakeDir {
  isFile: false;
  isDirectory: true;
  name: string;
  fullPath: string;
  createReader(): { readEntries(ok: (entries: FakeEntry[]) => void): void };
}

const fakeFile = (fullPath: string, text: string): FakeFile => ({
  isFile: true,
  isDirectory: false,
  name: fullPath.split('/').pop()!,
  fullPath,
  file: (ok) => ok(new File([text], fullPath.split('/').pop()!)),
});

// Browsers return directory listings in batches; readEntries must be called until it yields [].
const fakeDir = (fullPath: string, children: FakeEntry[], batch = 2): FakeDir => ({
  isFile: false,
  isDirectory: true,
  name: fullPath.split('/').pop()!,
  fullPath,
  createReader() {
    let offset = 0;
    return {
      readEntries(ok) {
        const page = children.slice(offset, offset + batch);
        offset += batch;
        queueMicrotask(() => ok(page));
      },
    };
  },
});

describe('filesFromDrop', () => {
  it('walks dropped folders recursively, reading every batch', async () => {
    const root = fakeDir('/data', [
      fakeFile('/data/car.prm', 'c'),
      fakeFile('/data/item.prm', 'i'),
      fakeFile('/data/worlds.prm', 'w'),
      fakeDir('/data/resource', [fakeFile('/data/resource/a.wav', 'a')]),
    ]);
    const dropped = await filesFromDrop([root as unknown as FileSystemEntry]);
    expect(dropped.map((d) => d.path).sort()).toEqual([
      'data/car.prm',
      'data/item.prm',
      'data/resource/a.wav',
      'data/worlds.prm',
    ]);
  });
});
