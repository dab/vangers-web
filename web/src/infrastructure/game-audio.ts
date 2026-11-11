export type AudioContextLike = Pick<
  AudioContext,
  'state' | 'resume' | 'suspend' | 'createBuffer' | 'createBufferSource' | 'destination'
>;

const createDefault = (): AudioContextLike | null => {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
};

// Browsers (Safari above all) only start audio inside a user gesture, but the engine opens its
// audio device seconds later. The context is created and unlocked on Play and handed to SDL.
export class GameAudio {
  private constructor(readonly context: AudioContextLike | null) {}

  static unlock(create: () => AudioContextLike | null = createDefault): GameAudio {
    const context = create();
    if (context) {
      void context.resume();
      const silence = context.createBufferSource();
      silence.buffer = context.createBuffer(1, 1, 22050);
      silence.connect(context.destination);
      silence.start(0);
    }
    return new GameAudio(context);
  }

  async visibilityChanged(hidden: boolean): Promise<void> {
    if (!this.context) return;
    if (hidden) await this.context.suspend();
    else await this.context.resume();
  }
}
