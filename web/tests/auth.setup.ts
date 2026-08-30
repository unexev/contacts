import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate with local credentials', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="email"]').fill('local@contacts.com');
  await page.locator('input[type="password"]').fill('kaento2000');
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL(/\/contacts/, { timeout: 15000 });
  await expect(page).toHaveURL(/\/contacts/);
  await page.context().storageState({ path: authFile });
});
