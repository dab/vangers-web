# Emscripten's SDL3 port ships a config without version metadata; this shim adds it.
include("${EMSCRIPTEN_SYSROOT}/lib/cmake/SDL3/sdl3-config.cmake")
set(SDL3_FOUND TRUE)
set(SDL3_SDL3_FOUND TRUE)
