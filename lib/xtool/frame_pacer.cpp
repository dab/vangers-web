#include "frame_pacer.h"

FramePacer::FramePacer(double tolerance_ms)
	: tolerance_ms_(tolerance_ms), next_due_ms_(0.0), started_(false) {}

bool FramePacer::due(double now_ms, double interval_ms) {
	if (!started_) {
		started_ = true;
		next_due_ms_ = now_ms + interval_ms;
		return true;
	}
	if (now_ms < next_due_ms_ - tolerance_ms_)
		return false;
	next_due_ms_ += interval_ms;
	if (next_due_ms_ < now_ms)
		next_due_ms_ = now_ms + interval_ms;
	return true;
}

void FramePacer::reset() {
	started_ = false;
}
