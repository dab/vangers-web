import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

const dataDir = process.env.VANGERS_DATA_DIR!;
test.use({ viewport: { width: 1280, height: 720 } });

const engine = <T>(page: Page, fn: string) => page.evaluate((f) => (window as any).vangersEngine[f](), fn) as Promise<T>;

async function onPrehistoryPage(page: Page) {
  const png = PNG.sync.read(await page.screenshot({ scale: 'css' }));
  let red = 0;
  for (let y = 40; y < 80; y++)
    for (let x = 500; x < 760; x++) {
      const i = (y * png.width + x) * 4;
      if (png.data[i]! > 150 && png.data[i + 1]! < 80) red++;
    }
  return red > 300;
}

async function click(page: Page, x: number, y: number) {
  await page.mouse.move(x, y, { steps: 5 });
  await page.waitForTimeout(300);
  await page.mouse.click(x, y);
}

async function measure(page: Page, label: string, ms: number, during?: () => Promise<void>) {
  await engine(page, 'resetPerf');
  const start = Date.now();
  if (during) await during();
  await page.waitForTimeout(Math.max(0, ms - (Date.now() - start)));
  const elapsed = (Date.now() - start) / 1000;
  const perf = await engine<{ quants: number; averageMs: number; p95Ms: number; maxMs: number; overBudget: number }>(page, 'perf');
  const result = { label, quantsPerSecond: +(perf.quants / elapsed).toFixed(1), ...perf };
  console.log(`PERF ${test.info().project.name} ${JSON.stringify(result)}`);
  return result;
}

test('holds 60 quants per second in the menu and while driving', async ({ page }) => {
  await page.goto('./?arg=-skipintro');
  await page.locator('input[data-pick="folder"]').setInputFiles(dataDir);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 240_000 });
  const bootStart = Date.now();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).vangersSession?.kind), { timeout: 120_000, intervals: [100] })
    .toBe('running');
  console.log(`PERF ${test.info().project.name} boot ${((Date.now() - bootStart) / 1000).toFixed(1)}s`);
  await page.waitForTimeout(8000);
  const menu = await measure(page, 'menu', 5000);

  await expect
    .poll(async () => {
      await click(page, 444, 54);
      await page.waitForTimeout(1500);
      return onPrehistoryPage(page);
    }, { timeout: 60_000, intervals: [500] })
    .toBe(true);
  await click(page, 640, 513);
  await page.waitForTimeout(8000);
  await expect
    .poll(async () => {
      await click(page, 225, 80);
      await page.waitForTimeout(3000);
      return engine<boolean>(page, 'isDriving');
    }, { timeout: 90_000, intervals: [1000] })
    .toBe(true);
  await page.waitForTimeout(3000);

  const world = await measure(page, 'driving', 10_000, async () => {
    await page.keyboard.down('ArrowUp');
    for (let i = 0; i < 4; i++) {
      await page.keyboard.down(i % 2 ? 'ArrowLeft' : 'ArrowRight');
      await page.waitForTimeout(2000);
      await page.keyboard.up(i % 2 ? 'ArrowLeft' : 'ArrowRight');
    }
    await page.keyboard.up('ArrowUp');
  });

  // Menus run at the game's designed 20 quants/s; the world at 60.
  expect(menu.quantsPerSecond).toBeGreaterThan(18);
  expect(world.quantsPerSecond).toBeGreaterThan(55);
  expect(world.p95Ms).toBeLessThanOrEqual(16);
});
