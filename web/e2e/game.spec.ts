import { expect, test, type Page } from '@playwright/test';
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

// Share of near-black pixels inside a rectangle of a page screenshot.
async function darkShare(page: Page, x: number, y: number, w: number, h: number) {
  const png = PNG.sync.read(await page.screenshot());
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
