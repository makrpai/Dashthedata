import { expect, test } from '@playwright/test';

test.describe('automatic dashboard (phase 5)', () => {
  test('sample data creates a dashboard with KPIs, a trend and reasons', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await page.goto('/workspace/data');
    await page.getByRole('button', { name: 'Kokeile esimerkkidatalla' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Tuo valitut' }).click();
    await expect(page).toHaveURL(/\/workspace\/transform\//, { timeout: 60_000 });
    await page.getByRole('navigation', { name: 'Päävalikko' }).getByRole('link', { name: /^Dashboardit/ }).click();
    const tiles = page.locator('main article');
    await expect(tiles.first()).toBeVisible({ timeout: 30_000 });
    expect(await tiles.count()).toBeGreaterThanOrEqual(6);
    await expect(page.getByRole('article', { name: 'Myynti ajan mukaan', exact: true })).toBeVisible();
    await expect(page.getByRole('article', { name: 'Myynti / Alue', exact: true })).toBeVisible();
    await expect(page.getByRole('article', { name: 'Myynti / Tuoteryhmä', exact: true })).toBeVisible();
    // "Why this?" explains the June anomaly in Tampere.
    const byRegion = page.getByRole('article', { name: 'Myynti ajan mukaan / Alue' });
    await byRegion.getByRole('button', { name: 'Miksi tämä?' }).click();
    await expect(page.getByText(/kesä 2025 poikkeaa selvästi muista kohteessa Tampere/)).toBeVisible();
    // Suggestion panel adds more charts.
    await expect(page.getByRole('complementary', { name: 'Ehdotukset' })).toBeVisible();
  });
});
