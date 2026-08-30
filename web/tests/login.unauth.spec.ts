import { test, expect } from '@playwright/test';

test.describe('Unauthenticated Login Flow', () => {
  test('should display login form', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();
  });

  test('should login with local credentials and redirect to contacts', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="email"]').fill('local@contacts.com');
    await page.locator('input[type="password"]').fill('kaento2000');
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/contacts/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/contacts/);
  });
});
