#!/usr/bin/env bash
# Builds the WebAssembly engine and copies it where Vite serves it (web/public/engine).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BUILD="$ROOT/build-web/engine"
[[ -f "$ROOT/build-web/deps/lib/libclunk.a" ]] || "$ROOT/web/scripts/build-deps.sh"
[[ -f "$BUILD/build.ninja" ]] || emcmake cmake -S "$ROOT" -B "$BUILD" -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build "$BUILD"
mkdir -p "$ROOT/web/public/engine"
cp "$BUILD/src/vangers.mjs" "$BUILD/src/vangers.wasm" "$ROOT/web/public/engine/"
echo "Engine copied to web/public/engine"
