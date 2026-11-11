import { describe, expect, it } from 'vitest';
import { suggestLandscape } from '../../src/domain/display/display';

describe('suggestLandscape', () => {
  it('suggests turning a tablet held upright', () => {
    expect(suggestLandscape({ touch: true, width: 744, height: 1133, dismissed: false })).toBe(true);
  });

  it('stays quiet in landscape', () => {
    expect(suggestLandscape({ touch: true, width: 1133, height: 744, dismissed: false })).toBe(false);
  });

  it('never nags desktop users with tall windows', () => {
    expect(suggestLandscape({ touch: false, width: 700, height: 1000, dismissed: false })).toBe(false);
  });

  it('respects a dismissal', () => {
    expect(suggestLandscape({ touch: true, width: 744, height: 1133, dismissed: true })).toBe(false);
  });

  it('treats a square-ish screen as fine', () => {
    expect(suggestLandscape({ touch: true, width: 900, height: 1000, dismissed: false })).toBe(false);
  });
});
