import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { zipSource } from '../../src/infrastructure/zip-source';

const archive = () =>
  new Blob([
    zipSync({
      'Vangers/': {},
      'Vangers/data/worlds.prm': [strToU8('worlds'), { level: 0 }],
      'Vangers/data/car.prm': strToU8('car '.repeat(1000)),
      'Vangers/data/resource/big.bin': new Uint8Array(300_000).map((_, i) => i % 251),
      '__MACOSX/Vangers/._car.prm': strToU8('resource fork'),
    }),
  ]);

async function collect(source: ReturnType<typeof zipSource>, wanted: string[]) {
  const out = new Map<string, Uint8Array>();
  for await (const entry of source.entries(new Set(wanted))) out.set(entry.path, entry.data);
  return out;
}

describe('zipSource', () => {
  it('lists files with uncompressed sizes from the central directory, skipping folders', async () => {
    const files = await zipSource(archive()).list();
    expect(files).toEqual([
      { path: 'Vangers/data/worlds.prm', size: 6 },
      { path: 'Vangers/data/car.prm', size: 4000 },
      { path: 'Vangers/data/resource/big.bin', size: 300_000 },
      { path: '__MACOSX/Vangers/._car.prm', size: 13 },
    ]);
  });

  it('streams only the wanted files, decompressed', async () => {
    const out = await collect(zipSource(archive(), 4096), ['Vangers/data/car.prm', 'Vangers/data/resource/big.bin']);
    expect([...out.keys()].sort()).toEqual(['Vangers/data/car.prm', 'Vangers/data/resource/big.bin']);
    expect(new TextDecoder().decode(out.get('Vangers/data/car.prm'))).toBe('car '.repeat(1000));
    const big = out.get('Vangers/data/resource/big.bin')!;
    expect(big.length).toBe(300_000);
    expect(big[1000]).toBe(1000 % 251);
  });

  it('reads stored (uncompressed) entries', async () => {
    const out = await collect(zipSource(archive()), ['Vangers/data/worlds.prm']);
    expect(new TextDecoder().decode(out.get('Vangers/data/worlds.prm'))).toBe('worlds');
  });

  it('explains when the file is not a zip archive', async () => {
    await expect(zipSource(new Blob(['not a zip at all'])).list()).rejects.toThrow(/not a zip/i);
  });
});
