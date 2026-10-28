import { test, expect } from '@playwright/test';

test('home communicates the product and exposes sharing actions', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /sharing should be this simple/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /create a drop/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /have a code/i })).toBeVisible();
  await expect(page.getByLabel('Choose files or drag files here')).toBeVisible();
});

test('mobile layout has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const width = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(width.content).toBeLessThanOrEqual(width.viewport);
});
