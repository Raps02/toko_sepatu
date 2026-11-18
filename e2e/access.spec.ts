import { expect, test } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

test.describe('Hak akses', () => {
  test('customer tidak bisa membuka dashboard staf', async ({ page }) => {
    await login(page, ACCOUNTS.customer);

    await page.goto('/dashboard');
    await expect(page).toHaveURL('/');
  });

  test('admin diarahkan ke dashboard setelah login', async ({ page }) => {
    await login(page, ACCOUNTS.admin);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Halo, Admin')).toBeVisible();
  });
});
