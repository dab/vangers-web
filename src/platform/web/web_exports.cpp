// Play-state queries for the browser shell (browser build only).
#include <emscripten.h>

extern int iScreenActive;
extern int Pause;
extern int ViewX, ViewY;

extern "C" {

// True while the player is driving in the world (no escave, menu or pause screen).
EMSCRIPTEN_KEEPALIVE int web_is_driving() {
	return !iScreenActive && !Pause ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE int web_camera_x() {
	return ViewX;
}

EMSCRIPTEN_KEEPALIVE int web_camera_y() {
	return ViewY;
}
}
