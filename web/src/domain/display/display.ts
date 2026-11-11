export interface ScreenShape {
  touch: boolean;
  width: number;
  height: number;
  dismissed: boolean;
}

// The game is designed for landscape (4:3 to ~2:1); clearly upright tablets lose half the screen.
export function suggestLandscape({ touch, width, height, dismissed }: ScreenShape): boolean {
  return touch && !dismissed && height / width > 1.2;
}
