#pragma once

// Per-frame main-thread work times, bucketed by millisecond, for performance probes.
class FrameStats {
  public:
	void record(double work_ms);
	void reset();

	int frames() const {
		return frames_;
	}
	int over_budget(double budget_ms) const;
	double percentile(int percent) const;
	double average() const;
	double max() const {
		return max_;
	}

  private:
	static constexpr int BUCKETS = 100;
	int histogram_[BUCKETS + 1] = {};
	int frames_ = 0;
	double total_ = 0.0;
	double max_ = 0.0;
};
