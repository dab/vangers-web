import type { Session } from '../domain/session/session';

export interface LauncherActions {
  pickFolder(files: FileList): void;
  pickZip(file: File): void;
  play(): void;
  forget(): void;
  restart(): void;
}

export interface LauncherView {
  touch: boolean;
}

const mb = (bytes: number) => `${Math.round(bytes / 1048576)} MB`;
const percent = (done: number, total: number) => (total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0);

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const progress = (label: string, done: number, total: number, note: string) => `
  <div class="progress" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="100"
       aria-valuenow="${percent(done, total)}">
    <div class="progress-fill" style="--fill:${percent(done, total)}%"></div>
  </div>
  <p class="status">${label}: ${mb(done)} of ${mb(total)}</p>
  <p class="note">${note}</p>`;

const whereToFind = (touch: boolean) => `
  <details class="help">
    <summary>Where are the game files?</summary>
    ${
      touch
        ? `<p>On a computer, compress the <code>data</code> folder from your Vangers installation into a .zip
           and save it to Files or iCloud Drive. Then choose that .zip here.</p>
           <p>Playing from the Home Screen? Open Vangers from its Home Screen icon before choosing the .zip:
           the Home Screen app keeps its own copy of the game files and saves.</p>`
        : ''
    }
    <p>Use the <code>data</code> folder inside the game folder:</p>
    <dl>
      <dt>Steam on Windows</dt><dd><code>C:\\Program Files (x86)\\Steam\\steamapps\\common\\Vangers\\data</code></dd>
      <dt>Steam on macOS</dt><dd><code>~/Library/Application Support/Steam/steamapps/common/Vangers/data</code>
        <span class="hint">In the folder dialog press ⇧⌘G and paste this path.</span></dd>
      <dt>Steam on Linux</dt><dd><code>~/.local/share/Steam/steamapps/common/Vangers/data</code></dd>
      <dt>GOG</dt><dd>The <code>data</code> folder in the game's install folder.</dd>
    </dl>
  </details>`;

function body(session: Session, view: LauncherView): string {
  switch (session.kind) {
    case 'checking':
      return `<p class="status">Checking for game files…</p>`;
    case 'needs-data':
      return `
        <p class="lede">Vangers runs right here in your browser, using the game files from your own copy.
          They are copied into this browser once and never leave your device.</p>
        <div class="actions">
          ${
            view.touch
              ? `<label class="button primary">Choose a .zip of the game files
                   <input type="file" accept=".zip,application/zip" data-pick="zip" hidden></label>`
              : `<label class="button primary">Choose the data folder
                   <input type="file" webkitdirectory data-pick="folder" hidden></label>
                 <label class="button">Choose a .zip instead
                   <input type="file" accept=".zip,application/zip" data-pick="zip" hidden></label>`
          }
        </div>
        ${view.touch ? '' : `<p class="note">You can also drop the folder or .zip anywhere on this page.</p>`}
        ${session.error ? `<p class="error" role="alert">${escape(session.error)}</p>` : ''}
        ${whereToFind(view.touch)}`;
    case 'importing':
      return progress(
        'Copying game files',
        session.doneBytes,
        session.totalBytes,
        'This happens only once. Keep this tab open until it finishes.',
      );
    case 'ready':
      return `
        <div class="actions"><button class="button primary play" data-action="play">Play</button></div>
        <p class="note">Game files: ${mb(session.totalBytes)} stored in this browser.
          <button class="link" data-action="forget">Remove them</button></p>`;
    case 'booting':
      return progress('Loading the game', session.doneBytes, session.totalBytes, '');
    case 'running':
      return '';
    case 'crashed':
      return `
        <p class="error" role="alert">The game stopped unexpectedly: ${escape(session.reason)}</p>
        <div class="actions"><button class="button primary" data-action="restart">Restart</button></div>
        <p class="note">Your saved games are kept.</p>`;
  }
}

export function renderLauncher(root: HTMLElement, session: Session, view: LauncherView) {
  root.hidden = session.kind === 'running';
  root.dataset.state = session.kind;
  root.querySelector<HTMLElement>('.launcher-body')!.innerHTML = body(session, view);
}

export function bindLauncher(root: HTMLElement, actions: LauncherActions) {
  root.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;
    if (input.dataset.pick === 'folder') actions.pickFolder(files);
    if (input.dataset.pick === 'zip') actions.pickZip(files[0]!);
    input.value = '';
  });
  root.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'play') actions.play();
    if (action === 'forget') actions.forget();
    if (action === 'restart') actions.restart();
  });
}
