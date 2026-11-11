import { describe, expect, it } from 'vitest';
import {
  buildManifest,
  isImportCandidate,
  normalizePath,
} from '../../src/domain/game-data/game-data-manifest';

const required = ['worlds.prm', 'car.prm', 'item.prm'];
const file = (path: string, size = 10) => ({ path, size });

describe('normalizePath', () => {
  it('converts Windows separators and strips leading ./ and /', () => {
    expect(normalizePath('.\\data\\resource\\a.bmp')).toBe('data/resource/a.bmp');
    expect(normalizePath('/data/car.prm')).toBe('data/car.prm');
  });

  it('collapses duplicate slashes', () => {
    expect(normalizePath('data//resource///x')).toBe('data/resource/x');
  });
});

describe('isImportCandidate', () => {
  it.each([
    'data/vangers64.pdb',
    'data/logfile.txt',
    'Vangers/vangers.exe',
    'Vangers/SDL3.dll',
    'data/.DS_Store',
    '__MACOSX/data/._car.prm',
    'data/Thumbs.db',
  ])('skips files the game never reads: %s', (path) => {
    expect(isImportCandidate(path)).toBe(false);
  });

  it.each(['data/car.prm', 'data/resource/video/intro/intro.avi', 'data/thechain/fostral/output.vmc'])(
    'keeps game data: %s',
    (path) => {
      expect(isImportCandidate(path)).toBe(true);
    },
  );
});

describe('buildManifest', () => {
  it('accepts a data folder selected directly', () => {
    const result = buildManifest([...required.map((p) => file(`data/${p}`)), file('data/resource/m3d/a.m3d')]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.root).toBe('data/');
    expect(result.manifest.files.map((f) => f.gamePath)).toContain('resource/m3d/a.m3d');
  });

  it('finds the data folder inside the game folder or a zip wrapper', () => {
    const result = buildManifest([
      file('Vangers/vangers.exe'),
      ...required.map((p) => file(`Vangers/data/${p}`)),
      file('Vangers/data/resource/sound/a.wav'),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.root).toBe('Vangers/data/');
    expect(result.manifest.files.every((f) => !f.gamePath.startsWith('Vangers'))).toBe(true);
  });

  it('accepts data files at the archive root', () => {
    const result = buildManifest(required.map((p) => file(p)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.root).toBe('');
  });

  it('drops files outside the data root and excluded files', () => {
    const result = buildManifest([
      ...required.map((p) => file(`data/${p}`)),
      file('readme.txt'),
      file('data/vangers64.pdb'),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.files.map((f) => f.gamePath).sort()).toEqual([...required].sort());
  });

  it('keeps the original stored path so files can be read back', () => {
    const result = buildManifest(required.map((p) => file(`Vangers/data/${p}`)));
    if (!result.ok) throw new Error('expected ok');
    const car = result.manifest.files.find((f) => f.gamePath === 'car.prm');
    expect(car?.sourcePath).toBe('Vangers/data/car.prm');
  });

  it('marks videos as streamed on demand and the rest as preloaded', () => {
    const result = buildManifest([
      ...required.map((p) => file(`data/${p}`, 100)),
      file('data/resource/video/intro/intro.avi', 5000),
      file('data/resource/video/MECH00.AVI', 7000),
    ]);
    if (!result.ok) throw new Error('expected ok');
    const byPath = new Map(result.manifest.files.map((f) => [f.gamePath, f.loading]));
    expect(byPath.get('resource/video/intro/intro.avi')).toBe('on-demand');
    expect(byPath.get('resource/video/MECH00.AVI')).toBe('on-demand');
    expect(byPath.get('car.prm')).toBe('preload');
    expect(result.manifest.preloadBytes).toBe(300);
    expect(result.manifest.totalBytes).toBe(12300);
  });

  it('prefers the shallowest data root when nested copies exist', () => {
    const result = buildManifest([
      ...required.map((p) => file(`data/${p}`)),
      ...required.map((p) => file(`data/backup/data/${p}`)),
    ]);
    if (!result.ok) throw new Error('expected ok');
    expect(result.manifest.root).toBe('data/');
  });

  it('reports which required files are missing for a wrong folder', () => {
    const result = buildManifest([file('Pictures/cat.jpg'), file('Pictures/car.prm')]);
    expect(result).toEqual({ ok: false, error: { kind: 'not-game-data', missing: ['worlds.prm', 'item.prm'] } });
  });

  it('rejects an empty selection', () => {
    expect(buildManifest([])).toEqual({ ok: false, error: { kind: 'empty' } });
  });
});
