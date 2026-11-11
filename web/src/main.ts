import './ui/launcher.css';
import { importGameData } from './application/import-game-data';
import type { ImportSource } from './domain/game-data/import-source';
import { initialSession, transition, type Session, type SessionEvent } from './domain/session/session';
import { startEngine } from './infrastructure/engine-host';
import { GameAudio } from './infrastructure/game-audio';
import { filesFromDrop, filesFromPicker, filesSource } from './infrastructure/files-source';
import { IdbGameDataStore } from './infrastructure/idb-game-data-store';
import { zipSource } from './infrastructure/zip-source';
import { mountGameChrome } from './ui/game-chrome';
import { mountTouchControls } from './ui/touch-controls';
import { bindLauncher, renderLauncher } from './ui/launcher';
import { describeImportFailure } from './ui/messages';

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
const launcher = document.querySelector<HTMLElement>('.launcher')!;
const store = new IdbGameDataStore();
const view = { touch: matchMedia('(pointer: coarse)').matches };
const engineArgs = new URLSearchParams(location.search).getAll('arg');

let session: Session = initialSession;
function dispatch(event: SessionEvent) {
  const next = transition(session, event);
  if (next === session) return;
  session = next;
  renderLauncher(launcher, session, view);
  (window as unknown as { vangersSession: Session }).vangersSession = session;
}

async function showBackdrop() {
  try {
    const bmp = await store.read('hd_background.bmp');
    const url = URL.createObjectURL(new Blob([bmp as BlobPart], { type: 'image/bmp' }));
    launcher.style.setProperty('--backdrop', `url("${url}")`);
  } catch {
    launcher.style.removeProperty('--backdrop');
  }
}

async function importFrom(source: ImportSource) {
  void navigator.storage?.persist?.();
  try {
    let started = false;
    const result = await importGameData(source, store, (doneBytes, totalBytes) => {
      if (!started) {
        started = true;
        dispatch({ type: 'import-started', totalBytes });
      }
      dispatch({ type: 'import-progress', doneBytes });
    });
    if (!result.ok) {
      dispatch({ type: 'import-started', totalBytes: 0 });
      dispatch({ type: 'import-failed', reason: describeImportFailure(result.error) });
      return;
    }
    dispatch({ type: 'import-done', totalBytes: result.manifest.totalBytes });
    void showBackdrop();
  } catch (error) {
    dispatch({ type: 'import-started', totalBytes: 0 });
    dispatch({ type: 'import-failed', reason: describeImportFailure(error) });
  }
}

async function play() {
  const audio = GameAudio.unlock();
  document.addEventListener('visibilitychange', () => void audio.visibilityChanged(document.hidden));
  (window as unknown as { vangersAudio: unknown }).vangersAudio = audio.context;
  const manifest = await store.loadManifest();
  if (!manifest) return dispatch({ type: 'data-forgotten' });
  dispatch({ type: 'play' });
  try {
    const engine = await startEngine(canvas, store, manifest, {
      onProgress: (doneBytes) => dispatch({ type: 'boot-progress', doneBytes }),
      onCrash: (reason) => dispatch({ type: 'engine-crashed', reason }),
      onExit: () => location.reload(),
    }, engineArgs, audio.context);
    dispatch({ type: 'engine-running' });
    (window as unknown as { vangersEngine: unknown }).vangersEngine = engine;
    mountGameChrome(canvas, view.touch);
    if (view.touch) mountTouchControls(engine);
    canvas.focus();
  } catch (error) {
    dispatch({ type: 'engine-crashed', reason: error instanceof Error ? error.message : String(error) });
  }
}

bindLauncher(launcher, {
  pickFolder: (files) => void importFrom(filesSource(filesFromPicker(files))),
  pickZip: (file) => void importFrom(zipSource(file)),
  play: () => void play(),
  forget: async () => {
    await store.clear();
    launcher.style.removeProperty('--backdrop');
    dispatch({ type: 'data-forgotten' });
  },
  restart: () => location.reload(),
});

window.addEventListener('dragover', (event) => {
  if (session.kind !== 'needs-data') return;
  event.preventDefault();
  launcher.classList.add('dragging');
});
window.addEventListener('dragleave', () => launcher.classList.remove('dragging'));
window.addEventListener('drop', (event) => {
  launcher.classList.remove('dragging');
  if (session.kind !== 'needs-data') return;
  event.preventDefault();
  const items = [...(event.dataTransfer?.items ?? [])];
  const entries = items.map((item) => item.webkitGetAsEntry()).filter((e): e is FileSystemEntry => e !== null);
  const single = entries.length === 1 ? entries[0] : undefined;
  if (single?.isFile && single.name.toLowerCase().endsWith('.zip')) {
    const file = items[0]?.getAsFile();
    if (file) void importFrom(zipSource(file));
    return;
  }
  void filesFromDrop(entries).then((files) => importFrom(filesSource(files)));
});
window.addEventListener('unhandledrejection', (event) => {
  if (session.kind === 'running') dispatch({ type: 'engine-crashed', reason: String(event.reason) });
});

renderLauncher(launcher, session, view);
const manifest = await store.loadManifest();
if (manifest) {
  dispatch({ type: 'cache-found', totalBytes: manifest.totalBytes });
  void showBackdrop();
} else {
  dispatch({ type: 'cache-empty' });
}
