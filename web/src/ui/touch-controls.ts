import { TouchControlsState, type ControlId, type KeyChange } from '../domain/input/touch-controls';
import type { RunningEngine } from '../infrastructure/engine-host';

const button = (control: ControlId, label: string, extra = '') =>
  `<button class="touch-button ${extra}" data-control="${control}" aria-label="${label}"><span>${label}</span></button>`;

const MARKUP = `
  <div class="steer-pad" data-control="steer" role="slider" aria-label="Steer" aria-valuemin="-1" aria-valuemax="1" aria-valuenow="0">
    <div class="steer-knob"></div>
  </div>
  <div class="touch-top">
    ${button('inventory', 'Inventory', 'small')}
    ${button('menu', 'Menu', 'small')}
  </div>
  <div class="touch-actions">
    ${button('use', 'Use', 'small')}
    ${button('jump', 'Jump')}
    ${button('fire', 'Fire')}
    ${button('brake', 'Brake')}
    ${button('reverse', 'Reverse')}
    ${button('gas', 'Gas', 'gas')}
  </div>`;

const POLL_MS = 200;

export function mountTouchControls(engine: RunningEngine) {
  const root = document.createElement('div');
  root.className = 'touch-controls';
  root.hidden = true;
  root.innerHTML = MARKUP;
  document.body.append(root);

  const state = new TouchControlsState();
  const pad = root.querySelector<HTMLElement>('.steer-pad')!;
  const knob = root.querySelector<HTMLElement>('.steer-knob')!;

  // The engine reads the keyboard through DOM key events, so a press here is a real key press to it.
  const apply = (changes: KeyChange[]) => {
    for (const { key, down } of changes) {
      window.dispatchEvent(
        new KeyboardEvent(down ? 'keydown' : 'keyup', { key: key.key, code: key.code, keyCode: key.keyCode, bubbles: true }),
      );
      if (key.code === 'ArrowLeft' || key.code === 'ArrowRight') {
        const steer = down ? (key.code === 'ArrowLeft' ? -1 : 1) : 0;
        knob.style.setProperty('--steer', String(steer));
        pad.setAttribute('aria-valuenow', String(steer));
      }
    }
  };
  const radius = () => pad.clientWidth * 0.35;

  root.addEventListener('pointerdown', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-control]');
    if (!target) return;
    event.preventDefault();
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      // The pointer may already be gone; the press still counts.
    }
    target.classList.add('held');
    apply(state.press(event.pointerId, target.dataset.control as ControlId, event.clientX));
  });
  root.addEventListener('pointermove', (event) => apply(state.move(event.pointerId, event.clientX, radius())));
  const lift = (event: PointerEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-control]');
    apply(state.release(event.pointerId));
    if (target && !state.isHeld(target.dataset.control as ControlId)) target.classList.remove('held');
  };
  root.addEventListener('pointerup', lift);
  root.addEventListener('pointercancel', lift);
  root.addEventListener('contextmenu', (event) => event.preventDefault());

  const releaseAll = () => {
    apply(state.releaseAll());
    root.querySelectorAll('.held').forEach((el) => el.classList.remove('held'));
  };
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => document.hidden && releaseAll());

  setInterval(() => {
    const driving = engine.isDriving();
    if (!driving && !root.hidden) releaseAll();
    root.hidden = !driving;
  }, POLL_MS);
}
