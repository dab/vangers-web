import { describe, expect, it } from 'vitest';
import { GameAudio, type AudioContextLike } from '../../src/infrastructure/game-audio';

class FakeContext implements AudioContextLike {
  state: AudioContextState = 'suspended';
  played = 0;
  async resume() {
    this.state = 'running';
  }
  async suspend() {
    this.state = 'suspended';
  }
  createBuffer() {
    return {} as AudioBuffer;
  }
  createBufferSource() {
    return { buffer: null, connect: () => {}, start: () => this.played++ } as unknown as AudioBufferSourceNode;
  }
  get destination() {
    return {} as AudioDestinationNode;
  }
}

describe('GameAudio', () => {
  it('unlocks the context inside the player’s gesture by resuming and playing silence', async () => {
    const context = new FakeContext();
    const audio = GameAudio.unlock(() => context);
    await Promise.resolve();
    expect(context.state).toBe('running');
    expect(context.played).toBe(1);
    expect(audio.context).toBe(context);
  });

  it('goes quiet while the tab is hidden and comes back when visible', async () => {
    const context = new FakeContext();
    const audio = GameAudio.unlock(() => context);
    await audio.visibilityChanged(true);
    expect(context.state).toBe('suspended');
    await audio.visibilityChanged(false);
    expect(context.state).toBe('running');
  });

  it('works without Web Audio (the game runs silent)', () => {
    const audio = GameAudio.unlock(() => null);
    expect(audio.context).toBeNull();
    return expect(audio.visibilityChanged(true)).resolves.toBeUndefined();
  });
});
