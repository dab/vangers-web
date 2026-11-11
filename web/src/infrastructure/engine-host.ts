import type { GameDataManifest } from '../domain/game-data/game-data-manifest';
import type { GameDataStore } from '../domain/game-data/game-data-store';
import { OnDemandFiles } from './on-demand-files';

const DATA_DIR = '/data';
const PARALLEL_READS = 8;

interface EmscriptenFs {
  mkdirTree(path: string): void;
  writeFile(path: string, data: Uint8Array): void;
  unlink(path: string): void;
  chdir(path: string): void;
}

interface VangersModule {
  FS: EmscriptenFs;
  callMain(args: string[]): void;
  vangersMedia?: OnDemandFiles;
}

type CreateVangers = (options: Record<string, unknown>) => Promise<VangersModule>;

export interface EngineCallbacks {
  onProgress(doneBytes: number, totalBytes: number): void;
  onCrash(reason: string): void;
  onExit(): void;
}

const engineUrl = (file: string) => `${import.meta.env.BASE_URL}engine/${file}`;

async function loadModule(canvas: HTMLCanvasElement, callbacks: EngineCallbacks): Promise<VangersModule> {
  // Native import(): Vite would otherwise rewrite it and refuse to serve the prebuilt engine from public/.
  const nativeImport = new Function('url', 'return import(url)') as (url: string) => Promise<unknown>;
  const { default: createVangers } = (await nativeImport(engineUrl('vangers.mjs'))) as {
    default: CreateVangers;
  };
  return createVangers({
    canvas,
    locateFile: (path: string) => engineUrl(path),
    print: (text: string) => console.log(text),
    printErr: (text: string) => console.warn(text),
    onAbort: (reason: unknown) => callbacks.onCrash(String(reason)),
    onExit: () => callbacks.onExit(),
  });
}

function createDirectories(fs: EmscriptenFs, manifest: GameDataManifest) {
  const dirs = new Set(manifest.files.map((f) => f.gamePath.slice(0, f.gamePath.lastIndexOf('/') + 1)));
  for (const dir of dirs) fs.mkdirTree(`${DATA_DIR}/${dir}`);
}

async function preloadFiles(
  fs: EmscriptenFs,
  store: GameDataStore,
  manifest: GameDataManifest,
  onProgress: EngineCallbacks['onProgress'],
) {
  const queue = manifest.files.filter((f) => f.loading === 'preload');
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
): Promise<void> {
  const module = await loadModule(canvas, callbacks);
  createDirectories(module.FS, manifest);
  await preloadFiles(module.FS, store, manifest, callbacks.onProgress);
  module.vangersMedia = new OnDemandFiles(module.FS, DATA_DIR, (gamePath) => store.read(gamePath));
  module.FS.chdir(DATA_DIR);
  module.callMain(args);
}
