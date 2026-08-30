import { test, expect } from '@playwright/test';

test.describe('Authenticated Contacts App', () => {
  test('should access contacts directly when authenticated', async ({ page }) => {
    await page.goto('/contacts');
    await expect(page).toHaveURL(/\/contacts/);
  });

  test('should redirect to /contacts when visiting root while authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/contacts/);
  });
});
