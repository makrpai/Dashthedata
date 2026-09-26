import { expect, test } from '@playwright/test';

const items = [
  { name: 'Dashboardit', path: '/workspace/dashboards' },
  { name: 'Data', path: '/workspace/data' },
  { name: 'Siivous', path: '/workspace/transform' },
  { name: 'Malli', path: '/workspace/model' },
  { name: 'Kysy datalta', path: '/workspace/ask' },
  { name: 'Integraatiot', path: '/workspace/integrations' },
  { name: 'Tekoäly', path: '/workspace/ai' },
  { name: 'Asetukset', path: '/workspace/settings' },
  { name: 'Ohje', path: '/workspace/help' },
];

test.describe('sidebar (scenario 11)', () => {
  test('every item opens its route and marks aria-current', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/workspace/help');
    const nav = page.getByRole('navigation', { name: 'Päävalikko' });
    for (const item of items) {
      await nav.getByRole('link', { name: new RegExp(`^${item.name}`) }).click();
      await expect(page).toHaveURL(new RegExp(`${item.path}`));
      await expect(nav.getByRole('link', { name: new RegExp(`^${item.name}`) })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
  });

  test('collapse state survives a reload', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/workspace/help');
    await page.getByRole('button', { name: 'Pienennä valikko' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-sidebar', 'collapsed');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-sidebar', 'collapsed');
    await expect(page.getByRole('button', { name: 'Laajenna valikko' })).toBeVisible();
    await page.keyboard.press('[');
    await expect(page.locator('html')).toHaveAttribute('data-sidebar', 'expanded');
  });

  test('arrow keys move between items', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/workspace/dashboards');
    const nav = page.getByRole('navigation', { name: 'Päävalikko' });
    await nav.getByRole('link', { name: /^Dashboardit/ }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(nav.getByRole('link', { name: /^Data/ })).toBeFocused();
  });

  test('opens as a drawer on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/workspace/dashboards');
    await page.getByRole('button', { name: 'Avaa valikko' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('link', { name: /^Ohje/ }).click();
    await expect(page).toHaveURL(/\/workspace\/help/);
    await expect(dialog).toBeHidden();
  });

  test('theme, contrast and language switch', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/workspace/settings');
    await page.getByRole('radio', { name: 'Yö' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('radio', { name: 'Korkea' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
    const shadow = await page
      .locator('aside.dtd-sidebar')
      .evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).toBe('none');
    await page.getByRole('radio', { name: 'English' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });
});
