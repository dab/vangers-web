import type { GameDataManifest } from '../domain/game-data/game-data-manifest';
import type { GameDataStore } from '../domain/game-data/game-data-store';
import { isSaveGame, SAVE_DIR, savesToSeed } from '../domain/saves/saves';
import { OnDemandFiles } from './on-demand-files';

const DATA_DIR = '/data';
const PERSIST_DIR = '/persist';
const PERSIST_SAVES = `${PERSIST_DIR}/savegame`;
const PARALLEL_READS = 8;

interface EmscriptenFs {
  mkdirTree(path: string): void;
  writeFile(path: string, data: Uint8Array): void;
  unlink(path: string): void;
  chdir(path: string): void;
  readdir(path: string): string[];
  symlink(target: string, path: string): void;
  mount(type: unknown, options: Record<string, unknown>, mountpoint: string): void;
  syncfs(populate: boolean, done: (error: unknown) => void): void;
}

interface VangersModule {
  FS: EmscriptenFs;
  IDBFS: unknown;
  callMain(args: string[]): void;
  vangersMedia?: OnDemandFiles;
  _web_is_driving(): number;
  _web_camera_x(): number;
  _web_camera_y(): number;
}

export interface RunningEngine {
  isDriving(): boolean;
  camera(): [number, number];
}

type CreateVangers = (options: Record<string, unknown>) => Promise<VangersModule>;

export interface EngineCallbacks {
  onProgress(doneBytes: number, totalBytes: number): void;
  onCrash(reason: string): void;
  onExit(): void;
}

const engineUrl = (file: string) => `${import.meta.env.BASE_URL}engine/${file}`;

async function loadModule(
  canvas: HTMLCanvasElement,
  callbacks: EngineCallbacks,
  audioContext: unknown,
): Promise<VangersModule> {
  // Native import(): Vite would otherwise rewrite it and refuse to serve the prebuilt engine from public/.
  const nativeImport = new Function('url', 'return import(url)') as (url: string) => Promise<unknown>;
  const { default: createVangers } = (await nativeImport(engineUrl('vangers.mjs'))) as {
    default: CreateVangers;
  };
  return createVangers({
    canvas,
    SDL3: audioContext ? { audioContext } : undefined,
    locateFile: (path: string) => engineUrl(path),
    print: (text: string) => console.log(text),
    printErr: (text: string) => console.warn(text),
    onAbort: (reason: unknown) => callbacks.onCrash(String(reason)),
    onExit: () => callbacks.onExit(),
  });
}

const syncfs = (fs: EmscriptenFs, populate: boolean) =>
  new Promise<void>((resolve, reject) => fs.syncfs(populate, (error) => (error ? reject(error) : resolve())));

// Saves and settings live in an IndexedDB-backed mount that persists on every file close.
async function mountPersistentStorage(module: VangersModule, store: GameDataStore, manifest: GameDataManifest) {
  const { FS } = module;
  FS.mkdirTree(PERSIST_DIR);
  FS.mount(module.IDBFS, { autoPersist: true }, PERSIST_DIR);
  await syncfs(FS, true);
  FS.mkdirTree(PERSIST_SAVES);
  const existing = FS.readdir(PERSIST_SAVES).filter((name) => name !== '.' && name !== '..');
  for (const gamePath of savesToSeed(manifest.files.map((f) => f.gamePath), existing)) {
    FS.writeFile(`${PERSIST_DIR}/${gamePath}`, await store.read(gamePath));
  }
  FS.symlink(PERSIST_SAVES, `${DATA_DIR}/${SAVE_DIR.slice(0, -1)}`);
  const flush = () => void syncfs(FS, false).catch(() => {});
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
}

function createDirectories(fs: EmscriptenFs, manifest: GameDataManifest) {
  const dirs = new Set(
    manifest.files.filter((f) => !isSaveGame(f.gamePath)).map((f) => f.gamePath.slice(0, f.gamePath.lastIndexOf('/') + 1)),
  );
  for (const dir of dirs) fs.mkdirTree(`${DATA_DIR}/${dir}`);
}

async function preloadFiles(
  fs: EmscriptenFs,
  store: GameDataStore,
  manifest: GameDataManifest,
  onProgress: EngineCallbacks['onProgress'],
) {
  const queue = manifest.files.filter((f) => f.loading === 'preload' && !isSaveGame(f.gamePath));
  let doneBytes = 0;
  const worker = async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      fs.writeFile(`${DATA_DIR}/${file.gamePath}`, await store.read(file.gamePath));
      doneBytes += file.size;
      onProgress(doneBytes, manifest.preloadBytes);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL_READS }, worker));
}

export async function startEngine(
  canvas: HTMLCanvasElement,
  store: GameDataStore,
  manifest: GameDataManifest,
  callbacks: EngineCallbacks,
  args: string[] = [],
  audioContext: unknown = null,
): Promise<RunningEngine> {
  const module = await loadModule(canvas, callbacks, audioContext);
  createDirectories(module.FS, manifest);
  await preloadFiles(module.FS, store, manifest, callbacks.onProgress);
  await mountPersistentStorage(module, store, manifest);
  module.vangersMedia = new OnDemandFiles(module.FS, DATA_DIR, (gamePath) => store.read(gamePath));
  module.FS.chdir(DATA_DIR);
  module.callMain(args);
  return {
    isDriving: () => module._web_is_driving() === 1,
    camera: () => [module._web_camera_x(), module._web_camera_y()],
  };
}
