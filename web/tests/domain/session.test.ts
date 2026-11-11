import { describe, expect, it } from 'vitest';
import { initialSession, transition, type Session, type SessionEvent } from '../../src/domain/session/session';

const run = (events: SessionEvent[], from: Session = initialSession) => events.reduce(transition, from);

describe('session', () => {
  it('starts by checking the local cache', () => {
    expect(initialSession).toEqual({ kind: 'checking' });
  });

  it('asks for data on first visit', () => {
    expect(run([{ type: 'cache-empty' }])).toEqual({ kind: 'needs-data' });
  });

  it('is ready to play when data is cached', () => {
    expect(run([{ type: 'cache-found', totalBytes: 100 }])).toEqual({ kind: 'ready', totalBytes: 100 });
  });

  it('tracks import progress as a fraction', () => {
    const s = run([
      { type: 'cache-empty' },
      { type: 'import-started', totalBytes: 200 },
      { type: 'import-progress', doneBytes: 50 },
    ]);
    expect(s).toEqual({ kind: 'importing', doneBytes: 50, totalBytes: 200 });
  });

  it('becomes ready after a successful import', () => {
    const s = run([
      { type: 'cache-empty' },
      { type: 'import-started', totalBytes: 200 },
      { type: 'import-done', totalBytes: 180 },
    ]);
    expect(s).toEqual({ kind: 'ready', totalBytes: 180 });
  });

  it('returns to the data screen with a reason when an import is rejected', () => {
    const s = run([
      { type: 'cache-empty' },
      { type: 'import-started', totalBytes: 200 },
      { type: 'import-failed', reason: 'Missing worlds.prm' },
    ]);
    expect(s).toEqual({ kind: 'needs-data', error: 'Missing worlds.prm' });
  });

  it('boots the engine only after the player asks to play', () => {
    const ready = run([{ type: 'cache-found', totalBytes: 100 }]);
    expect(transition(ready, { type: 'boot-progress', doneBytes: 1 })).toBe(ready);
    const s = run([{ type: 'play' }, { type: 'boot-progress', doneBytes: 40 }], ready);
    expect(s).toEqual({ kind: 'booting', doneBytes: 40, totalBytes: 100 });
  });

  it('runs once the engine reports it started', () => {
    const s = run([{ type: 'cache-found', totalBytes: 100 }, { type: 'play' }, { type: 'engine-running' }]);
    expect(s).toEqual({ kind: 'running' });
  });

  it('shows a fatal error when the engine crashes', () => {
    const s = run([
      { type: 'cache-found', totalBytes: 100 },
      { type: 'play' },
      { type: 'engine-running' },
      { type: 'engine-crashed', reason: 'RuntimeError: unreachable' },
    ]);
    expect(s).toEqual({ kind: 'crashed', reason: 'RuntimeError: unreachable' });
  });

  it('can forget cached data from the ready screen', () => {
    const s = run([{ type: 'cache-found', totalBytes: 100 }, { type: 'data-forgotten' }]);
    expect(s).toEqual({ kind: 'needs-data' });
  });

  it('ignores events that make no sense in the current state', () => {
    const running: Session = { kind: 'running' };
    expect(transition(running, { type: 'import-started', totalBytes: 1 })).toBe(running);
    expect(transition(running, { type: 'data-forgotten' })).toBe(running);
  });
});
