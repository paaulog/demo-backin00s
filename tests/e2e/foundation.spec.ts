import { expect, test } from '@playwright/test';

test('layout base e doação (S1)', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('stage')).toBeVisible();
  await expect(page.getByTestId('controls')).toBeVisible();
  const donate = page.getByRole('link', { name: /apoiar/i });
  await expect(donate).toHaveAttribute('rel', 'noopener noreferrer');
});

test('CSP presente no build', async ({ page }) => {
  await page.goto('./');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("object-src 'none'");
});
