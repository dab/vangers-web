#include "web_frame.h"

#include <emscripten.h>

EM_ASYNC_JS(double, web_next_animation_frame, (), {
	return await new Promise(requestAnimationFrame);
});

void web_wait_for_quant(FramePacer &pacer, double interval_ms) {
	while (!pacer.due(web_next_animation_frame(), interval_ms)) {
	}
}
