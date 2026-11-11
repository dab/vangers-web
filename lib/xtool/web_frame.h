#pragma once

#include "frame_pacer.h"

// Yields to the browser until the next display frame on which a quant is due.
void web_wait_for_quant(FramePacer &pacer, double interval_ms);
