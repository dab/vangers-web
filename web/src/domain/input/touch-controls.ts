export interface Key {
  key: string;
  code: string;
  keyCode: number;
}

// The game's default keyboard bindings: on-screen controls press the same keys a keyboard player would.
export const KEYS = {
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
} as const satisfies Record<string, Key>;

export type ButtonId = Exclude<keyof typeof KEYS, 'left' | 'right'>;
export type ControlId = ButtonId | 'steer';
export type Direction = 'left' | 'right' | 'none';

export interface KeyChange {
  key: Key;
  down: boolean;
}

const STEER_THRESHOLD = 0.25;

export function steeringDirection(startX: number, x: number, radius: number): Direction {
  const deflection = (x - startX) / radius;
  if (deflection > STEER_THRESHOLD) return 'right';
  if (deflection < -STEER_THRESHOLD) return 'left';
  return 'none';
}

interface Touch {
  control: ControlId;
  startX: number;
  direction: Direction;
}

// Tracks which fingers hold which on-screen controls and reports the key presses that result.
export class TouchControlsState {
  private readonly touches = new Map<number, Touch>();

  private holders(control: ControlId) {
    let count = 0;
    for (const touch of this.touches.values()) if (touch.control === control) count++;
    return count;
  }

  isHeld(control: ControlId): boolean {
    return this.holders(control) > 0;
  }

  press(pointerId: number, control: ControlId, x: number): KeyChange[] {
    const alreadyHeld = this.isHeld(control);
    this.touches.set(pointerId, { control, startX: x, direction: 'none' });
    if (control === 'steer' || alreadyHeld) return [];
    return [{ key: KEYS[control], down: true }];
  }

  move(pointerId: number, x: number, radius: number): KeyChange[] {
    const touch = this.touches.get(pointerId);
    if (!touch || touch.control !== 'steer') return [];
    const direction = steeringDirection(touch.startX, x, radius);
    if (direction === touch.direction) return [];
    const changes: KeyChange[] = [];
    if (touch.direction !== 'none') changes.push({ key: KEYS[touch.direction], down: false });
    if (direction !== 'none') changes.push({ key: KEYS[direction], down: true });
    touch.direction = direction;
    return changes;
  }

  release(pointerId: number): KeyChange[] {
    const touch = this.touches.get(pointerId);
    if (!touch) return [];
    this.touches.delete(pointerId);
    if (touch.control === 'steer') {
      return touch.direction === 'none' ? [] : [{ key: KEYS[touch.direction], down: false }];
    }
    return this.isHeld(touch.control) ? [] : [{ key: KEYS[touch.control], down: false }];
  }

  releaseAll(): KeyChange[] {
    return [...this.touches.keys()].flatMap((id) => this.release(id));
  }
}
