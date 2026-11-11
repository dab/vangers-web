import { describe, expect, it } from 'vitest';
import { isSaveGame, savesToSeed } from '../../src/domain/saves/saves';

describe('isSaveGame', () => {
  it('recognises files in the savegame folder only', () => {
    expect(isSaveGame('savegame/save08.dat')).toBe(true);
    expect(isSaveGame('savegame.dat')).toBe(false);
    expect(isSaveGame('resource/savegame/x')).toBe(false);
  });
});

describe('savesToSeed', () => {
  const imported = ['savegame/save08.dat', 'savegame/save01.dat', 'car.prm'];

  it('brings the player’s existing saves along on first launch', () => {
    expect(savesToSeed(imported, [])).toEqual(['savegame/save01.dat', 'savegame/save08.dat']);
  });

  it('never overwrites saves made in the browser', () => {
    expect(savesToSeed(imported, ['save03.dat'])).toEqual([]);
  });
});
