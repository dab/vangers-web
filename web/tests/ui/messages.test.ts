import { describe, expect, it } from 'vitest';
import { describeImportFailure } from '../../src/ui/messages';

describe('describeImportFailure', () => {
  it('names the missing files and says which folder to pick', () => {
    expect(describeImportFailure({ kind: 'not-game-data', missing: ['worlds.prm', 'item.prm'] })).toBe(
      'This doesn’t look like Vangers game data: worlds.prm and item.prm are missing. Choose the folder named data inside the game folder.',
    );
  });

  it('handles an empty selection', () => {
    expect(describeImportFailure({ kind: 'empty' })).toBe(
      'No game files were found there. Choose the folder named data inside the game folder.',
    );
  });

  it('explains a full disk or storage quota', () => {
    const quota = new DOMException('quota', 'QuotaExceededError');
    expect(describeImportFailure(quota)).toBe(
      'This browser ran out of storage space for the game files. Free up disk space, then try again.',
    );
  });

  it('passes through other errors', () => {
    expect(describeImportFailure(new Error('This file is not a zip archive.'))).toBe(
      'The game files could not be copied: This file is not a zip archive.',
    );
  });
});
