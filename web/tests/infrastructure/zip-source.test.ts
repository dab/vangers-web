import { deflateSync, strToU8, zipSync } from 'fflate';
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
    const out = await collect(zipSource(archive()), ['Vangers/data/car.prm', 'Vangers/data/resource/big.bin']);
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

// Finder's "Compress" (ditto) writes sizes only in a trailing data descriptor (flag bit 3),
// including for stored entries, which streaming unzippers cannot delimit.
function finderStyleZip(entries: { name: string; data: Uint8Array; deflate: boolean }[]) {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const { name, data, deflate } of entries) {
    const nameBytes = strToU8(name);
    const body = deflate ? deflateSync(data) : data;
    const crc = 0;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0008, true);
    local.setUint16(8, deflate ? 8 : 0, true);
    local.setUint16(26, nameBytes.length, true);
    const descriptor = new DataView(new ArrayBuffer(16));
    descriptor.setUint32(0, 0x08074b50, true);
    descriptor.setUint32(4, crc, true);
    descriptor.setUint32(8, body.length, true);
    descriptor.setUint32(12, data.length, true);
    const header = new DataView(new ArrayBuffer(46));
    header.setUint32(0, 0x02014b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 20, true);
    header.setUint16(8, 0x0008, true);
    header.setUint16(10, deflate ? 8 : 0, true);
    header.setUint32(16, crc, true);
    header.setUint32(20, body.length, true);
    header.setUint32(24, data.length, true);
    header.setUint16(28, nameBytes.length, true);
    header.setUint32(42, offset, true);
    for (const part of [new Uint8Array(local.buffer), nameBytes, body, new Uint8Array(descriptor.buffer)]) {
      parts.push(part);
      offset += part.length;
    }
    central.push(new Uint8Array(header.buffer), nameBytes);
  }
  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[]);
}

describe('zipSource with Finder-made archives', () => {
  it('reads stored and deflated entries that only have trailing data descriptors', async () => {
    const video = new Uint8Array(50_000).map((_, i) => (i * 7) % 256);
    const looksLikeDescriptor = new Uint8Array([1, 2, 0x50, 0x4b, 0x07, 0x08, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 3]);
    const blob = finderStyleZip([
      { name: '__MACOSX/data/._x', data: looksLikeDescriptor, deflate: false },
      { name: 'data/resource/video/a.avi', data: video, deflate: false },
      { name: 'data/car.prm', data: strToU8('car '.repeat(500)), deflate: true },
      { name: 'data/item.prm', data: strToU8('items'), deflate: false },
    ]);
    const source = zipSource(blob);
    expect((await source.list()).map((f) => f.size)).toEqual([17, 50_000, 2000, 5]);
    const out = await collect(source, ['data/resource/video/a.avi', 'data/car.prm', 'data/item.prm']);
    expect(out.get('data/resource/video/a.avi')).toEqual(video);
    expect(new TextDecoder().decode(out.get('data/car.prm'))).toBe('car '.repeat(500));
    expect(new TextDecoder().decode(out.get('data/item.prm'))).toBe('items');
  });
});
