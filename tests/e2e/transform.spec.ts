import { expect, test } from '@playwright/test';

test.describe('clean-up (phase 3)', () => {
  test('sample Excel is cleaned automatically; removing a step and undoing it (scenario 3)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/workspace/data');
    await page.getByRole('button', { name: 'Kokeile esimerkkidatalla' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Tuo valitut' }).click();
    await expect(page.getByText('Lisättiin 2 datasettiä')).toBeVisible({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/workspace\/transform\//);

    const log = page.getByRole('region', { name: 'Siivousloki' });
    for (const kind of ['Käytä riviä otsikkona', 'Poista summarivit', 'Täytä alaspäin', 'Käännä sarakkeet riveiksi', 'Tunnista tyypit']) {
      await expect(log.getByText(kind, { exact: true })).toBeVisible();
    }
    await expect(page.getByText('288 riviä · 4 saraketta')).toBeVisible();
    await expect(page.getByRole('grid').getByRole('gridcell', { name: 'tammi 2025' }).first()).toBeVisible();

    // Remove the unpivot step → rows change, then undo.
    await log.getByRole('button', { name: 'Poista askel: Käännä sarakkeet riveiksi' }).click();
    await expect(page.getByText('24 riviä', { exact: false }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('288 riviä · 4 saraketta')).toBeHidden();
    await page.locator('main').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+z');
    await expect(page.getByText('288 riviä · 4 saraketta')).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Control+Shift+z');
    await expect(page.getByText('288 riviä · 4 saraketta')).toBeHidden({ timeout: 30_000 });
  });

  test('adding a calculated column shows formula errors and then works', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/workspace/data');
    await page.getByTestId('file-input').setInputFiles('public/samples/asiakkaat.csv');
    await expect(page.getByText('Lisättiin 1 datasetti')).toBeVisible({ timeout: 60_000 });
    await page.getByRole('link', { name: 'Avaa siivous' }).click();
    await page.getByRole('button', { name: 'Lisää askel' }).click();
    await page.getByRole('menuitem', { name: 'Laskettu sarake' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nimi', { exact: true }).fill('Iso kaupunki');
    await dialog.getByLabel('Kaava').fill('[kaupunkki] = "Helsinki"');
    await expect(dialog.getByRole('alert')).toContainText('tarkoititko [kaupunki]');
    await dialog.getByLabel('Kaava').fill('[kaupunki] = "Helsinki"');
    await dialog.getByRole('button', { name: 'Tallenna askel' }).click();
    await expect(page.getByRole('grid').getByText('Iso kaupunki')).toBeVisible({ timeout: 30_000 });
  });
});
