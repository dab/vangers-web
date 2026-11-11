import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const dataDir = process.env.VANGERS_DATA_DIR!;
const shots = process.env.VANGERS_SHOTS_DIR ?? 'test-results';

const sessionKind = (page: Page) => page.evaluate(() => (window as any).vangersSession?.kind as string);

const measureFps = (page: Page, ms: number) =>
  page.evaluate(
    (duration) =>
      new Promise<number>((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = () => {
          frames++;
          if (performance.now() - start < duration) requestAnimationFrame(tick);
          else resolve((frames * 1000) / (performance.now() - start));
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );

async function importData(page: Page) {
  await page.goto('/?arg=-skipintro');
  await page.locator('input[data-pick="folder"]').setInputFiles(dataDir);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 240_000 });
}

async function playToMenu(page: Page) {
  await page.getByRole('button', { name: 'Play' }).click();
  await expect.poll(() => sessionKind(page), { timeout: 120_000 }).toBe('running');
  await page.waitForTimeout(8000);
}

// Hover first: the game reads clicks at the cursor position it saw in earlier frames.
async function gameClick(page: Page, x: number, y: number) {
  await page.mouse.move(x, y, { steps: 5 });
  await page.waitForTimeout(300);
  await page.mouse.click(x, y);
}

// The Prehistory page has a red title where the main menu is green (1280x720 letterboxed).
async function onPrehistoryPage(page: Page) {
  const png = PNG.sync.read(await page.screenshot({ scale: 'css' }));
  let red = 0;
  for (let y = 40; y < 80; y++) {
    for (let x = 500; x < 760; x++) {
      const i = (y * png.width + x) * 4;
      if (png.data[i]! > 150 && png.data[i + 1]! < 80) red++;
    }
  }
  return red > 300;
}

// Share of near-black pixels inside a rectangle of a page screenshot.
async function darkShare(page: Page, x: number, y: number, w: number, h: number) {
  const png = PNG.sync.read(await page.screenshot({ scale: 'css' }));
  let dark = 0;
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      const i = (row * png.width + col) * 4;
      if (png.data[i]! + png.data[i + 1]! + png.data[i + 2]! < 30) dark++;
    }
  }
  return dark / (w * h);
}

const canvasSize = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector('canvas')!;
    return { backing: [c.width, c.height], css: [c.clientWidth, c.clientHeight] };
  });

test('imports the player’s data, plays, and remembers it after a reload', async ({ page }) => {
  page.on('pageerror', (error) => console.log('pageerror', error.message));
  await importData(page);
  await page.screenshot({ path: `${shots}/ready.png` });
  await page.reload();
  await playToMenu(page);
  await page.screenshot({ path: `${shots}/menu.png` });

  const fps = await measureFps(page, 5000);
  console.log('menu fps', fps.toFixed(1));
  expect(fps).toBeGreaterThan(55);
  expect(await sessionKind(page)).toBe('running');
});

test('the 4:3 menu keeps its shape on wide and tall windows', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await importData(page);
  await playToMenu(page);
  await page.screenshot({ path: `${shots}/wide.png` });

  expect(await canvasSize(page)).toEqual({ backing: [1280, 720], css: [1280, 720] });
  // 4:3 content in 1280x720 is 960 wide: 160 px pillars on each side.
  expect(await darkShare(page, 0, 100, 140, 520)).toBeGreaterThan(0.95);
  expect(await darkShare(page, 1140, 100, 140, 520)).toBeGreaterThan(0.95);
  expect(await darkShare(page, 400, 200, 480, 320)).toBeLessThan(0.5);

  await page.setViewportSize({ width: 744, height: 1133 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${shots}/tall.png` });
  expect(await canvasSize(page)).toEqual({ backing: [744, 1133], css: [744, 1133] });
  // 4:3 content in 744 wide is 558 tall: ~287 px bars above and below.
  expect(await darkShare(page, 50, 0, 644, 260)).toBeGreaterThan(0.95);
  expect(await darkShare(page, 50, 873, 644, 260)).toBeGreaterThan(0.95);
  expect(await darkShare(page, 150, 450, 444, 230)).toBeLessThan(0.5);
});

test.describe('on a tablet', () => {
  test.use({ viewport: { width: 744, height: 1133 }, hasTouch: true, isMobile: true });

  test('imports a Finder-made zip and suggests landscape until dismissed', async ({ page }) => {
    const { dataZipPath } = await import('./global-setup');
    await page.goto('/?arg=-skipintro');
    await page.locator('input[data-pick="zip"]').setInputFiles(dataZipPath);
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 240_000 });
    await page.getByRole('button', { name: 'Play' }).tap();
    await expect.poll(() => sessionKind(page), { timeout: 120_000 }).toBe('running');

    const hint = page.getByText('Turn your tablet sideways');
    await expect(hint).toBeVisible();
    await page.getByRole('button', { name: 'Keep it upright' }).tap();
    await expect(hint).toBeHidden();
    await page.setViewportSize({ width: 1133, height: 744 });
    await expect(hint).toBeHidden();
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${shots}/tablet-landscape.png` });
  });
});

test('fullscreen can be toggled from the corner button', async ({ page }) => {
  await importData(page);
  await playToMenu(page);
  await page.mouse.move(1200, 40);
  await page.getByRole('button', { name: 'Enter fullscreen' }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await page.getByRole('button', { name: 'Exit fullscreen' }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
});

// Reads Emscripten's IDBFS store for /persist: path -> file bytes.
const persistedFiles = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<Record<string, number[]>>((resolve, reject) => {
        const open = indexedDB.open('/persist');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('FILE_DATA')) return resolve({});
          const store = db.transaction('FILE_DATA').objectStore('FILE_DATA');
          const out: Record<string, number[]> = {};
          const cursor = store.openCursor();
          cursor.onsuccess = () => {
            const c = cursor.result;
            if (!c) return resolve(out);
            const contents = (c.value as { contents?: Uint8Array }).contents;
            out[c.key as string] = contents ? Array.from(contents) : [];
            c.continue();
          };
          cursor.onerror = () => reject(cursor.error);
        };
      }),
  );

test('saves and settings survive a page reload', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await importData(page);
  await playToMenu(page);

  // 4:3 menu letterboxed into 1280x720: content spans x 160..1120.
  // New game, then past the Prehistory page into the first escave, which autosaves on entry.
  await expect
    .poll(
      async () => {
        await gameClick(page, 444, 54);
        await page.waitForTimeout(1500);
        return onPrehistoryPage(page);
      },
      { timeout: 60_000, intervals: [500] },
    )
    .toBe(true);
  await gameClick(page, 640, 513);
  const steamAutosave = [...readFileSync(`${dataDir}/savegame/save08.dat`)];
  await expect
    .poll(async () => (await persistedFiles(page))['/persist/savegame/save08.dat'], { timeout: 60_000 })
    .not.toEqual(steamAutosave);
  await page.screenshot({ path: `${shots}/escave.png` });

  await page.reload();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  const files = await persistedFiles(page);
  expect(Object.keys(files)).toContain('/persist/settings.toml');
  // Slot 8 is the autosave. It starts as the player's Steam autosave and is rewritten on escave entry.
  expect(files['/persist/savegame/save08.dat']?.length).toBeGreaterThan(0);
  expect(files['/persist/savegame/save08.dat']).not.toEqual(steamAutosave);
});

test('the game plays through the audio context unlocked by the Play click', async ({ page }) => {
  await importData(page);
  await playToMenu(page);
  expect(await page.evaluate(() => (window as any).vangersAudio?.state)).toBe('running');
});
