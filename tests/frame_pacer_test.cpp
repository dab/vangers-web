#include <iostream>

#include "frame_pacer.h"

namespace {

int failures = 0;

void check(bool condition, const char *message) {
	if (!condition) {
		std::cerr << "FAIL: " << message << "\n";
		failures++;
	}
}

int count_runs(double refresh_hz, double interval_ms, double duration_ms) {
	FramePacer pacer;
	const int frames = static_cast<int>(refresh_hz * duration_ms / 1000.0);
	int runs = 0;
	for (int frame = 0; frame < frames; frame++) {
		if (pacer.due(frame * 1000.0 / refresh_hz, interval_ms))
			runs++;
	}
	return runs;
}

void runs_every_display_frame_at_60hz() {
	const int runs = count_runs(60.0, 16.0, 1000.0);
	check(runs == 60, "60 Hz display with a 16 ms quant should run every frame");
}

void runs_every_second_frame_at_120hz() {
	const int runs = count_runs(120.0, 16.0, 1000.0);
	check(runs >= 59 && runs <= 63, "120 Hz display should be throttled to ~60 quants/s");
}

void never_exceeds_quant_rate_at_144hz() {
	const int runs = count_runs(144.0, 16.0, 1000.0);
	check(runs >= 59 && runs <= 63, "144 Hz display should be throttled to ~60 quants/s");
}

void menus_run_every_third_frame_at_60hz() {
	const int runs = count_runs(60.0, 50.0, 1000.0);
	check(runs == 20, "50 ms menu quant should run 20 times per second at 60 Hz");
}

void tolerates_display_jitter() {
	FramePacer pacer;
	check(pacer.due(0.0, 50.0), "first call always runs");
	check(!pacer.due(16.6, 50.0), "too early");
	check(!pacer.due(33.3, 50.0), "too early");
	check(pacer.due(49.4, 50.0), "slightly early vsync must still run");
}

void does_not_burst_after_a_stall() {
	FramePacer pacer;
	pacer.due(0.0, 16.0);
	check(pacer.due(2000.0, 16.0), "runs after a long stall");
	check(!pacer.due(2001.0, 16.0), "must not catch up missed quants in a burst");
	check(pacer.due(2016.7, 16.0), "resumes the normal cadence");
}

void reset_runs_immediately() {
	FramePacer pacer;
	pacer.due(0.0, 50.0);
	pacer.reset();
	check(pacer.due(1.0, 16.0), "after reset (runtime object switch) the first quant runs at once");
}

} // namespace

int main() {
	runs_every_display_frame_at_60hz();
	runs_every_second_frame_at_120hz();
	never_exceeds_quant_rate_at_144hz();
	menus_run_every_third_frame_at_60hz();
	tolerates_display_jitter();
	does_not_burst_after_a_stall();
	reset_runs_immediately();
	if (failures == 0)
		std::cout << "frame_pacer: all tests passed\n";
	return failures == 0 ? 0 : 1;
}
