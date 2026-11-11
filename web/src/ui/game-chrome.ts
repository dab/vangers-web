import { suggestLandscape } from '../domain/display/display';

type FullscreenDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
type FullscreenEl = HTMLElement & { webkitRequestFullscreen?: () => void };

const fullscreenElement = () => document.fullscreenElement ?? (document as FullscreenDoc).webkitFullscreenElement;
const fullscreenSupported = () =>
  Boolean(document.fullscreenEnabled || (document.documentElement as FullscreenEl).webkitRequestFullscreen);

function toggleFullscreen() {
  if (fullscreenElement()) {
    void (document.exitFullscreen?.() ?? (document as FullscreenDoc).webkitExitFullscreen?.());
    return;
  }
  const root = document.documentElement as FullscreenEl;
  void (root.requestFullscreen?.({ navigationUI: 'hide' }) ?? root.webkitRequestFullscreen?.());
}

const ENTER = '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>';
const EXIT = '<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/>';

export function mountGameChrome(canvas: HTMLCanvasElement, touch: boolean) {
  const chrome = document.createElement('div');
  chrome.className = 'game-chrome';
  chrome.innerHTML = `
    <button class="chrome-button" data-chrome="fullscreen" aria-label="Enter fullscreen" hidden>
      <svg viewBox="0 0 24 24" aria-hidden="true">${ENTER}</svg>
    </button>
    <div class="rotate-hint" role="status" hidden>
      <p>Turn your tablet sideways to see the whole game.</p>
      <button class="link" data-chrome="dismiss-rotate">Keep it upright</button>
    </div>`;
  document.body.append(chrome);

  const fullscreen = chrome.querySelector<HTMLButtonElement>('[data-chrome="fullscreen"]')!;
  const hint = chrome.querySelector<HTMLElement>('.rotate-hint')!;
  let dismissed = false;

  const update = () => {
    const active = Boolean(fullscreenElement());
    fullscreen.hidden = !fullscreenSupported();
    fullscreen.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
    fullscreen.querySelector('svg')!.innerHTML = active ? EXIT : ENTER;
    hint.hidden = !suggestLandscape({ touch, width: innerWidth, height: innerHeight, dismissed });
  };

  chrome.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-chrome]')?.dataset.chrome;
    if (action === 'fullscreen') toggleFullscreen();
    if (action === 'dismiss-rotate') dismissed = true;
    update();
    canvas.focus();
  });

  let idle = 0;
  const wake = () => {
    chrome.classList.add('awake');
    clearTimeout(idle);
    idle = window.setTimeout(() => chrome.classList.remove('awake'), 2500);
  };
  window.addEventListener('pointermove', wake, { passive: true });
  window.addEventListener('pointerdown', wake, { passive: true });
  window.addEventListener('resize', update);
  document.addEventListener('fullscreenchange', update);
  document.addEventListener('webkitfullscreenchange', update);
  update();
  wake();
}
