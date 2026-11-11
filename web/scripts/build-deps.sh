#!/usr/bin/env bash
# Cross-builds the native dependencies that have no Emscripten port
# (Clunk, toml11, a minimal FFmpeg) into build-web/deps.
set -euo pipefail

CLUNK_COMMIT=b52d1fda2237ef9ec81d09664ad2bb3aadd0de68
TOML11_VERSION=4.4.0
TOML11_SHA256=815bfe6792aa11a13a133b86e7f0f45edc5d71eb78f5fb6686c49c7f792b9049
FFMPEG_VERSION=8.0
FFMPEG_SHA256=b2751fccb6cc4c77708113cd78b561059b6fa904b24162fa0be2d60273d27b8e
EMSCRIPTEN_PORTS="--use-port=sdl3 --use-port=zlib"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$ROOT/build-web/deps-src"
PREFIX="$ROOT/build-web/deps"
JOBS="$(sysctl -n hw.ncpu 2>/dev/null || nproc)"
mkdir -p "$WORK" "$PREFIX"

command -v emcc >/dev/null || { echo "emcc not found (brew install emscripten)" >&2; exit 1; }

verify_sha256() {
	local file="$1" expected="$2"
	local actual
	actual="$(shasum -a 256 "$file" | cut -d' ' -f1)"
	if [[ -z "$expected" ]]; then
		echo "NOTE: $file sha256=$actual (pin it in this script)"
	elif [[ "$actual" != "$expected" ]]; then
		echo "sha256 mismatch for $file: $actual != $expected" >&2
		exit 1
	fi
}

build_toml11() {
	[[ -f "$PREFIX/include/toml.hpp" ]] && return
	local archive="$WORK/toml11.tar.gz"
	curl --fail --location --retry 3 -o "$archive" \
		"https://github.com/ToruNiina/toml11/archive/refs/tags/v${TOML11_VERSION}.tar.gz"
	verify_sha256 "$archive" "$TOML11_SHA256"
	tar -xzf "$archive" -C "$WORK"
	emcmake cmake -Wno-deprecated -S "$WORK/toml11-$TOML11_VERSION" -B "$WORK/toml11-build" -G Ninja \
		-DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$PREFIX" -DTOML11_BUILD_TESTS=OFF
	cmake --install "$WORK/toml11-build"
}

build_clunk() {
	[[ -f "$PREFIX/lib/libclunk.a" ]] && return
	local src="$WORK/clunk"
	if [[ ! -d "$src/.git" ]]; then
		git init -q "$src"
		git -C "$src" remote add origin https://github.com/stalkerg/clunk.git
	fi
	git -C "$src" fetch -q --depth 1 origin "$CLUNK_COMMIT"
	git -C "$src" checkout -q --detach FETCH_HEAD
	emcmake cmake -S "$src" -B "$src/build-web" -G Ninja \
		-DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$PREFIX" -DBUILD_SHARED_LIBS=OFF \
		-DSDL3_DIR="$ROOT/web/cmake/sdl3" \
		-DCMAKE_C_FLAGS="$EMSCRIPTEN_PORTS" -DCMAKE_CXX_FLAGS="$EMSCRIPTEN_PORTS"
	cmake --build "$src/build-web" --parallel "$JOBS"
	cmake --install "$src/build-web"
}

build_ffmpeg() {
	[[ -f "$PREFIX/lib/libavformat.a" ]] && return
	local archive="$WORK/ffmpeg-$FFMPEG_VERSION.tar.xz"
	[[ -f "$archive" ]] || curl --fail --location --retry 3 -o "$archive" \
		"https://ffmpeg.org/releases/ffmpeg-$FFMPEG_VERSION.tar.xz"
	verify_sha256 "$archive" "$FFMPEG_SHA256"
	rm -rf "$WORK/ffmpeg-$FFMPEG_VERSION"
	tar -xJf "$archive" -C "$WORK"
	(
		cd "$WORK/ffmpeg-$FFMPEG_VERSION"
		emconfigure ./configure \
			--prefix="$PREFIX" \
			--enable-cross-compile --target-os=none --arch=x86_32 \
			--cc=emcc --cxx=em++ --ar=emar --ranlib=emranlib --nm=emnm \
			--extra-cflags="-O3 --use-port=zlib" --extra-ldflags="--use-port=zlib" \
			--disable-everything --disable-programs --disable-doc --disable-debug \
			--disable-asm --disable-inline-asm --disable-x86asm --disable-stripping \
			--disable-network --disable-autodetect --disable-pthreads --disable-runtime-cpudetect \
			--disable-avdevice --disable-avfilter --disable-swresample \
			--enable-zlib --enable-protocol=file --enable-demuxer=avi \
			--enable-decoder=indeo3,png,pcm_s16le \
			--enable-static --disable-shared
		emmake make -j"$JOBS"
		emmake make install
	)
}

build_toml11
build_clunk
build_ffmpeg
echo "Dependencies installed in $PREFIX"
