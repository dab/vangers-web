#include "web_frame.h"

#include "frame_stats.h"

#include <emscripten.h>
#include <emscripten/heap.h>
#include <unistd.h>

EM_ASYNC_JS(double, web_next_animation_frame, (), {
	return await new Promise(requestAnimationFrame);
});

namespace {
FrameStats frame_stats;
int quants = 0;
double resumed_at = -1.0;
} // namespace

void web_wait_for_quant(FramePacer &pacer, double interval_ms) {
	if (resumed_at >= 0.0)
		frame_stats.record(emscripten_get_now() - resumed_at);
	while (!pacer.due(web_next_animation_frame(), interval_ms)) {
	}
	quants++;
	resumed_at = emscripten_get_now();
}

// Performance probe for the browser shell and tests.
extern "C" {

EMSCRIPTEN_KEEPALIVE void web_perf_reset() {
	frame_stats.reset();
	quants = 0;
}

EMSCRIPTEN_KEEPALIVE int web_perf_quants() {
	return quants;
}

EMSCRIPTEN_KEEPALIVE double web_perf_average_ms() {
	return frame_stats.average();
}

EMSCRIPTEN_KEEPALIVE double web_perf_p95_ms() {
	return frame_stats.percentile(95);
}

EMSCRIPTEN_KEEPALIVE double web_perf_max_ms() {
	return frame_stats.max();
}

EMSCRIPTEN_KEEPALIVE int web_perf_over_budget() {
	return frame_stats.over_budget(16.7);
}

EMSCRIPTEN_KEEPALIVE double web_perf_heap_mb() {
	return emscripten_get_heap_size() / (1024.0 * 1024.0);
}

EMSCRIPTEN_KEEPALIVE double web_perf_heap_used_mb() {
	return reinterpret_cast<uintptr_t>(sbrk(0)) / (1024.0 * 1024.0);
}
}
