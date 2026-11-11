export const SAVE_DIR = 'savegame/';

export const isSaveGame = (gamePath: string) =>
  gamePath.startsWith(SAVE_DIR) && !gamePath.slice(SAVE_DIR.length).includes('/');

// Saves imported with the game data seed the browser's save folder once; after that,
// browser saves are the source of truth.
export function savesToSeed(importedGamePaths: string[], persistedSaveNames: string[]): string[] {
  if (persistedSaveNames.length > 0) return [];
  return importedGamePaths.filter(isSaveGame).sort();
}
