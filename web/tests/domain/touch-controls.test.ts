import { describe, expect, it } from 'vitest';
import { KEYS, steeringDirection, TouchControlsState } from '../../src/domain/input/touch-controls';

const down = (key: (typeof KEYS)[keyof typeof KEYS]) => ({ key, down: true });
const up = (key: (typeof KEYS)[keyof typeof KEYS]) => ({ key, down: false });

describe('steeringDirection', () => {
  it('steers once the finger slides past a small threshold', () => {
    expect(steeringDirection(100, 140, 60)).toBe('right');
    expect(steeringDirection(100, 60, 60)).toBe('left');
  });

  it('keeps straight for small jitter', () => {
    expect(steeringDirection(100, 108, 60)).toBe('none');
  });
});

describe('TouchControlsState', () => {
  it('holds the game’s own keys while a control is held (the original keyboard controls)', () => {
    const state = new TouchControlsState();
    expect(state.press(1, 'gas', 0)).toEqual([down(KEYS.gas)]);
    expect(state.release(1)).toEqual([up(KEYS.gas)]);
  });

  it('maps every control to the default key binding', () => {
    expect(KEYS).toEqual({
      left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
      right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
      gas: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
      reverse: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
      fire: { key: 'e', code: 'KeyE', keyCode: 69 },
      jump: { key: 'w', code: 'KeyW', keyCode: 87 },
      brake: { key: 'q', code: 'KeyQ', keyCode: 81 },
      use: { key: ' ', code: 'Space', keyCode: 32 },
      inventory: { key: 'Enter', code: 'Enter', keyCode: 13 },
      menu: { key: 'Escape', code: 'Escape', keyCode: 27 },
    });
  });

  it('steers with one finger while another holds gas', () => {
    const state = new TouchControlsState();
    expect(state.press(1, 'steer', 200)).toEqual([]);
    state.press(2, 'gas', 0);
    expect(state.move(1, 260, 60)).toEqual([down(KEYS.right)]);
    expect(state.move(1, 270, 60)).toEqual([]);
    expect(state.move(1, 140, 60)).toEqual([up(KEYS.right), down(KEYS.left)]);
    expect(state.move(1, 195, 60)).toEqual([up(KEYS.left)]);
    state.move(1, 120, 60);
    expect(state.release(1)).toEqual([up(KEYS.left)]);
    expect(state.release(2)).toEqual([up(KEYS.gas)]);
  });

  it('keeps a control held while any finger is still on it', () => {
    const state = new TouchControlsState();
    state.press(1, 'fire', 0);
    expect(state.press(2, 'fire', 0)).toEqual([]);
    expect(state.release(1)).toEqual([]);
    expect(state.isHeld('fire')).toBe(true);
    expect(state.release(2)).toEqual([up(KEYS.fire)]);
    expect(state.isHeld('fire')).toBe(false);
  });

  it('releases everything when the page loses focus, so the car never runs away', () => {
    const state = new TouchControlsState();
    state.press(1, 'gas', 0);
    state.press(2, 'steer', 100);
    state.move(2, 20, 60);
    state.press(3, 'fire', 0);
    expect(state.releaseAll()).toEqual(expect.arrayContaining([up(KEYS.gas), up(KEYS.left), up(KEYS.fire)]));
    expect(state.releaseAll()).toEqual([]);
  });

  it('ignores moves and releases of fingers it does not track', () => {
    const state = new TouchControlsState();
    expect(state.move(9, 10, 60)).toEqual([]);
    expect(state.release(9)).toEqual([]);
  });
});
