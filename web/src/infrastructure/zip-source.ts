import { Unzip, UnzipInflate, type UnzipFile } from 'fflate';
import { normalizePath, type SourceFile } from '../domain/game-data/game-data-manifest';
import type { ImportSource, SourceEntry } from '../domain/game-data/import-source';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_MIN = 22;
const EOCD_SEARCH = EOCD_MIN + 0xffff;

const notZip = () => new Error('This file is not a zip archive.');

async function readCentralDirectory(blob: Blob): Promise<SourceFile[]> {
  const tailStart = Math.max(0, blob.size - EOCD_SEARCH);
  const tail = new DataView(await blob.slice(tailStart).arrayBuffer());
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

  const directory = new DataView(await blob.slice(offset, offset + size).arrayBuffer());
  const decoder = new TextDecoder();
  const files: SourceFile[] = [];
  for (let p = 0; p + 46 <= directory.byteLength; ) {
    if (directory.getUint32(p, true) !== CENTRAL_SIGNATURE) throw notZip();
    const uncompressed = directory.getUint32(p + 24, true);
    const nameLength = directory.getUint16(p + 28, true);
    const extraLength = directory.getUint16(p + 30, true);
    const commentLength = directory.getUint16(p + 32, true);
    const name = decoder.decode(new Uint8Array(directory.buffer, directory.byteOffset + p + 46, nameLength));
    if (!name.endsWith('/')) files.push({ path: normalizePath(name), size: uncompressed });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function concat(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) return chunks[0]!;
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function* streamEntries(blob: Blob, wanted: ReadonlySet<string>, chunkSize: number) {
  const ready: SourceEntry[] = [];
  let failure: unknown = null;
  const unzip = new Unzip((file: UnzipFile) => {
    const path = normalizePath(file.name);
    if (!wanted.has(path)) return;
    const chunks: Uint8Array[] = [];
    file.ondata = (error, chunk, final) => {
      if (error) failure = error;
      else chunks.push(chunk);
      if (final && !error) ready.push({ path, data: concat(chunks) });
    };
    file.start();
  });
  unzip.register(UnzipInflate);

  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    const chunk = new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer());
    unzip.push(chunk, offset + chunkSize >= blob.size);
    if (failure) throw failure;
    while (ready.length) yield ready.shift()!;
  }
}

export function zipSource(blob: Blob, chunkSize = 4 << 20): ImportSource {
  return {
    list: () => readCentralDirectory(blob),
    entries: (wanted) => streamEntries(blob, wanted, chunkSize),
  };
}
