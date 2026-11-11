import { inflateSync } from 'fflate';
import { normalizePath } from '../domain/game-data/game-data-manifest';
import type { ImportSource } from '../domain/game-data/import-source';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN = 22;
const EOCD_SEARCH = EOCD_MIN + 0xffff;
const STORED = 0;
const DEFLATED = 8;

interface ZipEntry {
  path: string;
  size: number;
  compressedSize: number;
  method: number;
  localOffset: number;
}

const notZip = () => new Error('This file is not a zip archive.');

const view = async (blob: Blob, start: number, end?: number) => new DataView(await blob.slice(start, end).arrayBuffer());

// Random access through the central directory: sizes there are always correct, unlike local headers
// in archives made by macOS Finder, which defer them to data descriptors.
async function readCentralDirectory(blob: Blob): Promise<ZipEntry[]> {
  const tailStart = Math.max(0, blob.size - EOCD_SEARCH);
  const tail = await view(blob, tailStart);
  let eocd = -1;
  for (let i = tail.byteLength - EOCD_MIN; i >= 0; i--) {
    if (tail.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw notZip();

  const size = tail.getUint32(eocd + 12, true);
  const offset = tail.getUint32(eocd + 16, true);
  if (size === 0xffffffff || offset === 0xffffffff) throw new Error('ZIP64 archives are not supported.');

  const directory = await view(blob, offset, offset + size);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let p = 0; p + 46 <= directory.byteLength; ) {
    if (directory.getUint32(p, true) !== CENTRAL_SIGNATURE) throw notZip();
    const nameLength = directory.getUint16(p + 28, true);
    const extraLength = directory.getUint16(p + 30, true);
    const commentLength = directory.getUint16(p + 32, true);
    const name = decoder.decode(new Uint8Array(directory.buffer, directory.byteOffset + p + 46, nameLength));
    if (!name.endsWith('/')) {
      entries.push({
        path: normalizePath(name),
        method: directory.getUint16(p + 10, true),
        compressedSize: directory.getUint32(p + 20, true),
        size: directory.getUint32(p + 24, true),
        localOffset: directory.getUint32(p + 42, true),
      });
    }
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function readEntry(blob: Blob, entry: ZipEntry): Promise<Uint8Array> {
  const local = await view(blob, entry.localOffset, entry.localOffset + 30);
  if (local.getUint32(0, true) !== LOCAL_SIGNATURE) throw notZip();
  const start = entry.localOffset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
  const body = new Uint8Array(await blob.slice(start, start + entry.compressedSize).arrayBuffer());
  if (entry.method === STORED) return body;
  if (entry.method === DEFLATED) return inflateSync(body, { out: new Uint8Array(entry.size) });
  throw new Error(`${entry.path} uses an unsupported zip compression method (${entry.method}).`);
}

export function zipSource(blob: Blob): ImportSource {
  let directory: Promise<ZipEntry[]> | null = null;
  const entries = () => (directory ??= readCentralDirectory(blob));
  return {
    list: async () => (await entries()).map(({ path, size }) => ({ path, size })),
    async *entries(wanted) {
      for (const entry of await entries()) {
        if (wanted.has(entry.path)) yield { path: entry.path, data: await readEntry(blob, entry) };
      }
    },
  };
}
