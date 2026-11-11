# Vangers in the browser

The unchanged C++ engine compiled to WebAssembly with Emscripten, plus a small
TypeScript launcher. Players use the game files from their own copy (Steam or
GOG); the site itself contains no game data, so it can be hosted anywhere.

## Playing

**Play now: https://dab.github.io/vangers-web/**

1. Open the page and choose the `data` folder of your Vangers installation
   (or drop it onto the page). On a tablet, choose a `.zip` of that folder.
   - Steam on macOS: `~/Library/Application Support/Steam/steamapps/common/Vangers/data`
     (press ⇧⌘G in the folder dialog and paste the path)
   - Steam on Windows: `C:\Program Files (x86)\Steam\steamapps\common\Vangers\data`
   - Steam on Linux: `~/.local/share/Steam/steamapps/common/Vangers/data`
2. The files are copied into the browser once (about 371 MB). After that, Play
   starts the game directly. Saves and settings are kept in the browser too;
   saves from the imported folder come along on first launch.

**iPad and other tablets:** on a computer, compress the `data` folder
(Finder: right-click → Compress), move the zip to the tablet (AirDrop → Save to
Files, or iCloud Drive) and choose it in the launcher. On-screen driving
controls appear while you drive. For a full-screen app that keeps its data,
use Share → Add to Home Screen and import the zip from the Home Screen app (it
has its own storage, separate from Safari).

**Not available:** multiplayer (browsers cannot open the game's TCP
connections). On-screen touch buttons press the game's default keys, so custom
keyboard bindings don't apply to them.

## Building

Requirements: CMake 4, Ninja, Emscripten 7.0.0, Node 22.

```sh
brew install cmake ninja emscripten   # or emsdk on Linux/Windows
web/scripts/build-engine.sh          # first run also builds Clunk, toml11 and a minimal FFmpeg
cd web
npm install
npm run dev                          # http://localhost:5173
```

`build-engine.sh` cross-builds the dependencies without Emscripten ports
(`web/scripts/build-deps.sh`, pinned versions and checksums) into
`build-web/deps`, builds the engine into `build-web/engine` and copies
`vangers.mjs`/`vangers.wasm` to `web/public/engine`.

Engine arguments can be passed in the URL, for example `?arg=-skipintro`.

## Deploying

```sh
cd web && npm run build
```

Upload `web/dist` to any static host (GitHub Pages, Netlify, S3, nginx). It
works from a sub-path and needs no special headers (no threads, so no
cross-origin isolation). Make sure `.wasm` is served as `application/wasm`.

## Testing

| Command (in `web/`) | What it covers |
| --- | --- |
| `npm test` | Vitest: domain, application and adapters |
| `npx playwright test` | Launcher in desktop and tablet profiles (no game data needed) |
| `E2E_DIST=1 npx playwright test` | Same, against `dist/` served from `/vangers/` (run `npm run build` first) |
| `VANGERS_DATA_DIR=<your data folder> npx playwright test` | Full game in Chromium, WebKit and Firefox: import (folder and Finder zip), aspect ratio, persistence, audio, touch driving, 60 FPS probe |

Native engine changes are covered by CTest (`frame_pacer`, `frame_stats`).

In a running game, `vangersEngine.perf()` in the browser console reports
quants per second, per-frame work time, and heap use since
`vangersEngine.resetPerf()`.

## How it fits together

```
web/src/
  domain/          pure rules: game-data manifest, session state, saves, display, touch controls
  application/     use cases (importing game data)
  infrastructure/  browser adapters: folder/zip sources, IndexedDB, engine host, audio
  ui/              launcher, in-game chrome (fullscreen, rotate hint), touch controls
src/platform/web/  engine-side browser glue (networking stub, play-state queries)
lib/xtool/         frame pacing and statistics used by the browser main loop
```

- The engine's main loop yields to the browser on every display frame
  (Asyncify); `FramePacer` keeps quants at the game's designed rate on 60, 120
  and 144 Hz displays.
- Game files are loaded from IndexedDB into the in-memory filesystem when Play
  is pressed; videos stay in IndexedDB and are copied in only while open.
- Saves and `settings.toml` live in an IndexedDB-backed mount (`/persist`).
- The page owns the canvas size; SDL letterboxes the game, so any window size
  keeps the original aspect ratio.
