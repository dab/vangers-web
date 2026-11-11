#include "web_media.h"

#include <emscripten.h>

EM_ASYNC_JS(void, web_media_acquire_js, (const char *path), {
	if (Module.vangersMedia)
		await Module.vangersMedia.acquire(UTF8ToString(path));
});

EM_JS(void, web_media_release_js, (const char *path), {
	if (Module.vangersMedia)
		Module.vangersMedia.release(UTF8ToString(path));
});

void web_media_acquire(const char *path) {
	web_media_acquire_js(path);
}

void web_media_release(const char *path) {
	web_media_release_js(path);
}
