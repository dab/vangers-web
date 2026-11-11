import { describe, expect, it } from 'vitest';
import { OnDemandFiles, type WritableFs } from '../../src/infrastructure/on-demand-files';

class FakeFs implements WritableFs {
  files = new Map<string, Uint8Array>();
  writeFile(path: string, data: Uint8Array) {
    this.files.set(path, data);
  }
  unlink(path: string) {
    this.files.delete(path);
  }
}

const setup = (available: Record<string, number[]> = { 'resource/video/a.avi': [1, 2] }) => {
  const fs = new FakeFs();
  const reads: string[] = [];
  const files = new OnDemandFiles(fs, '/data', async (gamePath) => {
    reads.push(gamePath);
    const bytes = available[gamePath];
    if (!bytes) throw new Error('missing');
    return new Uint8Array(bytes);
  });
  return { fs, reads, files };
};

describe('OnDemandFiles', () => {
  it('materialises a file in the engine filesystem on first acquire', async () => {
    const { fs, files } = setup();
    await files.acquire('resource/video/a.avi');
    expect([...fs.files.get('/data/resource/video/a.avi')!]).toEqual([1, 2]);
  });

  it('reads the cache once while the file is in use and frees it after the last release', async () => {
    const { fs, reads, files } = setup();
    await files.acquire('resource/video/a.avi');
    await files.acquire('resource/video/a.avi');
    files.release('resource/video/a.avi');
    expect(fs.files.has('/data/resource/video/a.avi')).toBe(true);
    files.release('resource/video/a.avi');
    expect(fs.files.has('/data/resource/video/a.avi')).toBe(false);
    expect(reads).toEqual(['resource/video/a.avi']);
  });

  it('accepts absolute paths inside the data directory', async () => {
    const { fs, files } = setup();
    await files.acquire('/data/resource/video/a.avi');
    expect(fs.files.has('/data/resource/video/a.avi')).toBe(true);
  });

  it('leaves a missing file absent so the engine reports it like on desktop', async () => {
    const { fs, files } = setup({});
    await files.acquire('resource/video/none.avi');
    expect(fs.files.size).toBe(0);
    expect(() => files.release('resource/video/none.avi')).not.toThrow();
  });

  it('ignores releases without a matching acquire', () => {
    const { files } = setup();
    expect(() => files.release('resource/video/a.avi')).not.toThrow();
  });
});
