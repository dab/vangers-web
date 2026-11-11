# Dependency setup for the WebAssembly build (emcmake). SDL3, Ogg, Vorbis and zlib come
# from Emscripten ports; Clunk, toml11 and FFmpeg from web/scripts/build-deps.sh.

SET(VANGERS_WEB_DEPS "${PROJECT_SOURCE_DIR}/build-web/deps" CACHE PATH
	"Prefix produced by web/scripts/build-deps.sh")
IF(NOT EXISTS "${VANGERS_WEB_DEPS}/lib/libclunk.a")
	MESSAGE(FATAL_ERROR "Run web/scripts/build-deps.sh first (missing ${VANGERS_WEB_DEPS})")
ENDIF()

SET(VANGERS_WEB_PORTS --use-port=sdl3 --use-port=vorbis --use-port=ogg --use-port=zlib)
ADD_COMPILE_OPTIONS(${VANGERS_WEB_PORTS})
ADD_LINK_OPTIONS(${VANGERS_WEB_PORTS})

SET(SDL3_DIR "${PROJECT_SOURCE_DIR}/web/cmake/sdl3")
FIND_PACKAGE(SDL3 3.2 CONFIG REQUIRED COMPONENTS SDL3)
FIND_PACKAGE(toml11 4.4...<4.5 CONFIG REQUIRED
	PATHS "${VANGERS_WEB_DEPS}" NO_DEFAULT_PATH NO_CMAKE_FIND_ROOT_PATH)

ADD_LIBRARY(Clunk::Clunk INTERFACE IMPORTED)
SET_TARGET_PROPERTIES(Clunk::Clunk PROPERTIES
	INTERFACE_INCLUDE_DIRECTORIES "${VANGERS_WEB_DEPS}/include"
	INTERFACE_LINK_LIBRARIES "${VANGERS_WEB_DEPS}/lib/libclunk.a;SDL3::SDL3"
)

SET(FFMPEG_INCLUDE_DIRS
	"${VANGERS_WEB_DEPS}/include"
	"${VANGERS_WEB_DEPS}/include/libavcodec"
	"${VANGERS_WEB_DEPS}/include/libavformat"
)
SET(FFMPEG_LIBRARIES
	"${VANGERS_WEB_DEPS}/lib/libavformat.a"
	"${VANGERS_WEB_DEPS}/lib/libavcodec.a"
	"${VANGERS_WEB_DEPS}/lib/libswscale.a"
	"${VANGERS_WEB_DEPS}/lib/libavutil.a"
)
SET(CLUNK_INCLUDE_DIR "${VANGERS_WEB_DEPS}/include")
SET(OGG_LIBRARY "")
SET(VORBIS_LIBRARY "")
SET(VORBISFILE_LIBRARY "")
SET(ZLIB_LIBRARIES "")
