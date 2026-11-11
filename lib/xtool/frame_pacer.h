#pragma once

// Decides on which display frames a runtime-object quant runs, so the game keeps
// its designed quant rate on displays refreshing at 60, 120 or 144 Hz.
class FramePacer {
  public:
	explicit FramePacer(double tolerance_ms = 2.0);

	// Returns true (and records the run) when a quant is due at now_ms.
	bool due(double now_ms, double interval_ms);
	void reset();

  private:
	double tolerance_ms_;
	double next_due_ms_;
	bool started_;
};
