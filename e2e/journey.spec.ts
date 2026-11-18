import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('address → map → customize → generate → edit → preview → save → export', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('one-of-a-kind');
  await page.getByTestId('cta').click();

  // Location (demo spot: no live geocoder needed)
  await expect(page.getByRole('heading', { name: 'Where should we center your map?' })).toBeVisible();
  await page.getByTestId('demo-clifton').click();

  // Area
  await expect(page.getByTestId('area-picker')).toBeVisible();
  await page.getByTestId('coverage-small').click();
  await page.getByTestId('next').click();

  // Places
  await page.getByTestId('pref-food').click();
  await expect(page.getByTestId('pref-food')).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('next').click();

  // Personalize
  await page.getByTestId('for-name').fill('Emma');
  await expect(page.getByTestId('title-input')).toHaveValue('Emma’s Neighborhood');
  await page.getByTestId('home-label').fill('Our house');
  await page.getByTestId('next').click();

  // Style → generate
  await page.getByTestId('style-watercolor').click();
  await page.getByTestId('next').click();

  // Editor: a real illustrated map with roads, landmarks and the home marker
  await expect(page.getByTestId('editor')).toBeVisible({ timeout: 60_000 });
  const canvas = page.getByTestId('map-canvas');
  await expect(canvas).toBeVisible();
  expect(await canvas.locator('[data-kind="road"]').count()).toBeGreaterThan(100);
  expect(await canvas.locator('[data-kind="landmark"]').count()).toBeGreaterThan(3);
  await expect(canvas.locator('[data-kind="home"]')).toHaveCount(1);
  await expect(canvas.locator('[data-kind="attribution"]')).toHaveCount(1);

  // Select a landmark and rename it; undo restores it
  const before = await canvas.locator('[data-kind="landmark"]').count();
  await canvas.locator('[data-kind="landmark"]').nth(2).click();
  await expect(page.getByTestId('selection-box')).toBeVisible();
  const label = page.getByTestId('landmark-label');
  const original = await label.inputValue();
  await label.fill('Our favourite spot');
  await page.getByTestId('remove-landmark').click();
  await expect(canvas.locator('[data-kind="landmark"]')).toHaveCount(before - 1);
  if (isMobile) await page.getByRole('button', { name: 'Done' }).click();
  await page.getByTestId('undo').click();
  await expect(canvas.locator('[data-kind="landmark"]')).toHaveCount(before);
  expect(original.length).toBeGreaterThan(0);

  // Remove a road with the erase tool
  const roads = await canvas.locator('[data-kind="road"]').count();
  await page.getByTestId('tool-erase').click();
  await canvas.locator('[data-kind="road"]').nth(40).dispatchEvent('pointerdown', { button: 0, pointerId: 1, bubbles: true });
  await expect(canvas.locator('[data-kind="road"]')).toHaveCount(roads - 1);

  // Preview
  await page.getByTestId('next').click();
  await expect(page.getByTestId('mockup')).toBeVisible();
  await page.getByTestId('product-framed').click();
  await expect(page.getByTestId('mockup')).toHaveAttribute('data-scene', 'wall-frame');

  // Finish: save, then export
  await page.getByTestId('next').click();
  await page.getByTestId('save-project').click();
  await expect(page.getByTestId('saved-state')).toBeVisible({ timeout: 20_000 });

  const download = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByTestId('download-preview').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('maploom-preview.png');
  const bytes = readFileSync(await file.path());
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  expect(bytes.length).toBeGreaterThan(100_000);
  await expect(page.getByTestId('finish-message')).toContainText('Your file is ready');

  // Saved map shows up, can be reopened and deleted
  await page.goto('/projects');
  await expect(page.getByTestId('project-list')).toContainText('Emma’s Neighborhood');
  await page.getByTestId('open-project').click();
  await expect(page.getByTestId('editor')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('map-canvas').locator('[data-kind="home"]')).toHaveCount(1);
  await page.goto('/projects');
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('delete-project').click();
  await expect(page.getByTestId('project-list')).toContainText('Nothing saved yet');

  expect(errors).toEqual([]);
});

test('API rejects bad input with friendly errors and no internals', async ({ request }) => {
  const bad = await request.post('/api/geography', { data: { frame: { center: { lat: 999, lon: 0 }, widthM: 1, heightM: 1 } } });
  expect(bad.status()).toBe(400);
  const body = await bad.json();
  expect(body.error.code).toBe('INVALID_INPUT');
  expect(JSON.stringify(body)).not.toMatch(/stack|node_modules|\.ts:|\n\s+at /);

  expect((await request.get('/api/jobs/job_does_not_exist')).status()).toBe(404);
  expect((await request.get('/api/exports/exp_nope/download?exp=1&sig=x')).status()).toBe(401);
  expect((await request.post('/api/admin/action', { data: { action: 'purge' } })).status()).toBe(401);
  const cross = await request.post('/api/projects', { data: {}, headers: { origin: 'https://evil.example' } });
  expect(cross.status()).toBe(401);
  const home = await request.get('/');
  expect(home.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
});
