import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

test('first visit asks for the game files', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Vangers' })).toBeVisible();
  await expect(page.getByText('runs right here in your browser')).toBeVisible();
  await expect(page.getByText('Where are the game files?')).toBeVisible();
});

test('the page never scrolls or overflows', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.launcher-body')).not.toBeEmpty();
  const overflow = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - innerWidth,
    y: document.documentElement.scrollHeight - innerHeight,
  }));
  expect(overflow).toEqual({ x: 0, y: 0 });
});

test('desktop offers a folder picker, tablets a zip picker', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) {
    await expect(page.getByText('Choose a .zip of the game files')).toBeVisible();
    await expect(page.locator('input[webkitdirectory]')).toHaveCount(0);
  } else {
    await expect(page.getByText('Choose the data folder')).toBeVisible();
    await expect(page.getByText('Choose a .zip instead')).toBeVisible();
  }
});

test('a wrong folder is rejected with the missing files named', async ({ page, isMobile }) => {
  test.skip(isMobile, 'folder picker is desktop only');
  await page.goto('/');
  await page.locator('input[data-pick="folder"]').setInputFiles(fixture('fake-data'));
  await expect(page.getByRole('alert')).toContainText('item.prm is missing');
  await page.locator('input[data-pick="folder"]').setInputFiles(fixture('wrong-folder'));
  await expect(page.getByRole('alert')).toContainText('worlds.prm, car.prm and item.prm are missing');
});

test('a file that is not a zip is explained', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[data-pick="zip"]').setInputFiles({
    name: 'game.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from('definitely not a zip'),
  });
  await expect(page.getByRole('alert')).toContainText('not a zip archive');
});
