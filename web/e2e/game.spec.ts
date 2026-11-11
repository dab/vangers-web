import { expect, test, type Page } from '@playwright/test';

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

test('imports the player’s data, plays, and remembers it after a reload', async ({ page }) => {
  page.on('pageerror', (error) => console.log('pageerror', error.message));
  await page.goto('/?arg=-skipintro');
  await page.locator('input[data-pick="folder"]').setInputFiles(dataDir);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 240_000 });
  await page.screenshot({ path: `${shots}/ready.png` });

  await page.reload();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect.poll(() => sessionKind(page), { timeout: 120_000 }).toBe('running');
  await page.waitForTimeout(8000);
  await page.screenshot({ path: `${shots}/menu.png` });

  const fps = await measureFps(page, 5000);
  console.log('menu fps', fps.toFixed(1));
  expect(fps).toBeGreaterThan(55);
  expect(await sessionKind(page)).toBe('running');
});
