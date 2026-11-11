#include "frame_stats.h"

#include <algorithm>

void FrameStats::record(double work_ms) {
	const int bucket = std::clamp(static_cast<int>(work_ms), 0, BUCKETS);
	histogram_[bucket]++;
	frames_++;
	total_ += work_ms;
	max_ = std::max(max_, work_ms);
}

void FrameStats::reset() {
	*this = FrameStats();
}

int FrameStats::over_budget(double budget_ms) const {
	int count = 0;
	for (int bucket = 0; bucket <= BUCKETS; bucket++) {
		if (bucket >= budget_ms)
			count += histogram_[bucket];
	}
	return count;
}

// Upper edge of the bucket holding the given percentile, in milliseconds.
double FrameStats::percentile(int percent) const {
	if (frames_ == 0)
		return 0.0;
	const int target = (frames_ * percent + 99) / 100;
	int seen = 0;
	for (int bucket = 0; bucket <= BUCKETS; bucket++) {
		seen += histogram_[bucket];
		if (seen >= target)
			return bucket + 1.0;
	}
	return BUCKETS + 1.0;
}

double FrameStats::average() const {
	return frames_ ? total_ / frames_ : 0.0;
}
