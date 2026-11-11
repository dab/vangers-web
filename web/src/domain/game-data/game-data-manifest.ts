export interface SourceFile {
  path: string;
  size: number;
}

export type Loading = 'preload' | 'on-demand';

export interface ManifestFile {
  gamePath: string;
  sourcePath: string;
  size: number;
  loading: Loading;
}

export interface GameDataManifest {
  root: string;
  files: ManifestFile[];
  totalBytes: number;
  preloadBytes: number;
}

export type GameDataError = { kind: 'empty' } | { kind: 'not-game-data'; missing: string[] };

export type ManifestResult = { ok: true; manifest: GameDataManifest } | { ok: false; error: GameDataError };

export const REQUIRED_FILES = ['worlds.prm', 'car.prm', 'item.prm'] as const;

const EXCLUDED_EXTENSIONS = ['.pdb', '.exe', '.dll', '.ico'];
const EXCLUDED_NAMES = ['logfile.txt', '.ds_store', 'thumbs.db', 'desktop.ini'];

export function normalizePath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^(\.\/|\/)+/, '');
}

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const dirName = (path: string) => path.slice(0, path.lastIndexOf('/') + 1);

export function isImportCandidate(path: string): boolean {
  const normalized = normalizePath(path);
  if (normalized.startsWith('__MACOSX/') || normalized.includes('/__MACOSX/')) return false;
  const name = baseName(normalized).toLowerCase();
  if (name.startsWith('._') || EXCLUDED_NAMES.includes(name)) return false;
  return !EXCLUDED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function findRoot(paths: string[]): { root: string } | { missing: string[] } {
  const found = new Map<string, Set<string>>();
  for (const path of paths) {
    const name = baseName(path);
    if (!(REQUIRED_FILES as readonly string[]).includes(name)) continue;
    const dir = dirName(path);
    if (!found.has(dir)) found.set(dir, new Set());
    found.get(dir)!.add(name);
  }
  const complete = [...found.entries()]
    .filter(([, names]) => names.size === REQUIRED_FILES.length)
    .map(([dir]) => dir)
    .sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length);
  if (complete[0] !== undefined) return { root: complete[0] };

  const best = [...found.values()].sort((a, b) => b.size - a.size)[0] ?? new Set<string>();
  return { missing: REQUIRED_FILES.filter((name) => !best.has(name)) };
}

const loadingFor = (gamePath: string): Loading =>
  gamePath.toLowerCase().endsWith('.avi') ? 'on-demand' : 'preload';

export function buildManifest(sources: SourceFile[]): ManifestResult {
  const candidates = sources
    .map((source) => ({ ...source, path: normalizePath(source.path) }))
    .filter((source) => isImportCandidate(source.path));
  if (candidates.length === 0) return { ok: false, error: { kind: 'empty' } };

  const located = findRoot(candidates.map((source) => source.path));
  if ('missing' in located) return { ok: false, error: { kind: 'not-game-data', missing: located.missing } };

  const { root } = located;
  const files = candidates
    .filter((source) => source.path.startsWith(root))
    .map((source): ManifestFile => {
      const gamePath = source.path.slice(root.length);
      return { gamePath, sourcePath: source.path, size: source.size, loading: loadingFor(gamePath) };
    });

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const preloadBytes = files.filter((f) => f.loading === 'preload').reduce((sum, f) => sum + f.size, 0);
  return { ok: true, manifest: { root, files, totalBytes, preloadBytes } };
}
