export type Session =
  | { kind: 'checking' }
  | { kind: 'needs-data'; error?: string }
  | { kind: 'importing'; doneBytes: number; totalBytes: number }
  | { kind: 'ready'; totalBytes: number }
  | { kind: 'booting'; doneBytes: number; totalBytes: number }
  | { kind: 'running' }
  | { kind: 'crashed'; reason: string };

export type SessionEvent =
  | { type: 'cache-empty' }
  | { type: 'cache-found'; totalBytes: number }
  | { type: 'import-started'; totalBytes: number }
  | { type: 'import-progress'; doneBytes: number }
  | { type: 'import-done'; totalBytes: number }
  | { type: 'import-failed'; reason: string }
  | { type: 'data-forgotten' }
  | { type: 'play' }
  | { type: 'boot-progress'; doneBytes: number }
  | { type: 'engine-running' }
  | { type: 'engine-crashed'; reason: string };

export const initialSession: Session = { kind: 'checking' };

export function transition(session: Session, event: SessionEvent): Session {
  if (event.type === 'engine-crashed') return { kind: 'crashed', reason: event.reason };

  switch (session.kind) {
    case 'checking':
      if (event.type === 'cache-empty') return { kind: 'needs-data' };
      if (event.type === 'cache-found') return { kind: 'ready', totalBytes: event.totalBytes };
      return session;
    case 'needs-data':
      if (event.type === 'import-started') return { kind: 'importing', doneBytes: 0, totalBytes: event.totalBytes };
      return session;
    case 'importing':
      if (event.type === 'import-progress') return { ...session, doneBytes: event.doneBytes };
      if (event.type === 'import-done') return { kind: 'ready', totalBytes: event.totalBytes };
      if (event.type === 'import-failed') return { kind: 'needs-data', error: event.reason };
      return session;
    case 'ready':
      if (event.type === 'play') return { kind: 'booting', doneBytes: 0, totalBytes: session.totalBytes };
      if (event.type === 'data-forgotten') return { kind: 'needs-data' };
      return session;
    case 'booting':
      if (event.type === 'boot-progress') return { ...session, doneBytes: event.doneBytes };
      if (event.type === 'engine-running') return { kind: 'running' };
      return session;
    case 'running':
    case 'crashed':
      return session;
  }
}
