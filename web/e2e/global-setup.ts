import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const dataZipPath = fileURLToPath(new URL('../../build-web/test-data/vangers-data.zip', import.meta.url));

// Builds the zip a tablet player would make with Finder's "Compress" (ditto is the same tool).
export default function globalSetup() {
  const dataDir = process.env.VANGERS_DATA_DIR;
  if (!dataDir || existsSync(dataZipPath)) return;
  mkdirSync(fileURLToPath(new URL('../../build-web/test-data/', import.meta.url)), { recursive: true });
  execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', dataDir, dataZipPath]);
}
