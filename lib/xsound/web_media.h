#pragma once

// Browser build: large media files live in IndexedDB and are copied into the
// in-memory filesystem only while a video is open.
void web_media_acquire(const char *path);
void web_media_release(const char *path);
