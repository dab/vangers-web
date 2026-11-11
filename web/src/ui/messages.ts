import type { GameDataError } from '../domain/game-data/game-data-manifest';

const PICK_HINT = 'Choose the folder named data inside the game folder.';

const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

const isGameDataError = (value: unknown): value is GameDataError =>
  typeof value === 'object' && value !== null && 'kind' in value;

export function describeImportFailure(failure: GameDataError | unknown): string {
  if (isGameDataError(failure)) {
    if (failure.kind === 'empty') return `No game files were found there. ${PICK_HINT}`;
    const verb = failure.missing.length === 1 ? 'is' : 'are';
    return `This doesn’t look like Vangers game data: ${list(failure.missing)} ${verb} missing. ${PICK_HINT}`;
  }
  if (failure instanceof DOMException && failure.name === 'QuotaExceededError') {
    return 'This browser ran out of storage space for the game files. Free up disk space, then try again.';
  }
  const message = failure instanceof Error ? failure.message : String(failure);
  return `The game files could not be copied: ${message}`;
}
