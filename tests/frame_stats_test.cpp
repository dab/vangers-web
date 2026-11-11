#include <iostream>

#include "frame_stats.h"

namespace {

int failures = 0;

void check(bool condition, const char *message) {
	if (!condition) {
		std::cerr << "FAIL: " << message << "\n";
		failures++;
	}
}

} // namespace

int main() {
	FrameStats empty;
	check(empty.frames() == 0 && empty.percentile(95) == 0.0, "empty stats report zero");

	FrameStats stats;
	for (int i = 0; i < 95; i++)
		stats.record(4.2);
	for (int i = 0; i < 5; i++)
		stats.record(20.0);
	check(stats.frames() == 100, "counts frames");
	check(stats.over_budget(16.7) == 5, "counts frames over the 60 FPS budget");
	check(stats.percentile(50) <= 5.0, "median sits in the fast bucket");
	check(stats.percentile(95) <= 5.0, "95th percentile excludes the slowest 5%");
	check(stats.percentile(99) >= 20.0, "99th percentile reaches the slow frames");
	check(stats.max() == 20.0, "tracks the worst frame");
	check(stats.average() > 4.9 && stats.average() < 5.0, "average work time");

	stats.record(250.0);
	check(
		stats.max() == 250.0 && stats.percentile(100) >= 100.0,
		"very slow frames land in the overflow bucket"
	);

	stats.reset();
	check(stats.frames() == 0 && stats.max() == 0.0, "reset starts a new measurement");

	if (failures == 0)
		std::cout << "frame_stats: all tests passed\n";
	return failures == 0 ? 0 : 1;
}
