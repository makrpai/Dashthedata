import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';

const samples = join(__dirname, '../../public/samples');

async function upload(page: Page, files: string[]) {
  await page.getByTestId('file-input').setInputFiles(files.map((f) => join(samples, f)));
}

test.describe('file import (phase 1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto('/workspace/data');
  });

  test('sample Excel: sheet picker, both sheets, preview with ääkköset', async ({ page }) => {
    await page.getByRole('button', { name: 'Kokeile esimerkkidatalla' }).click();
    const dialog = page.getByRole('dialog', { name: 'Mitkä välilehdet tuodaan?' });
    await expect(dialog.getByRole('checkbox')).toHaveCount(2);
    await dialog.getByRole('button', { name: 'Tuo valitut' }).click();
    await expect(page.getByText('Lisättiin 2 datasettiä')).toBeVisible({ timeout: 60_000 });
    await page.getByRole('navigation', { name: 'Päävalikko' }).getByRole('link', { name: /^Data/ }).click();
    const grid = page.getByRole('grid');
    await expect(grid.getByRole('gridcell', { name: 'Tuoteryhmä', exact: true })).toBeVisible();
    await expect(grid.getByRole('gridcell', { name: 'Jyväskylä' }).first()).toBeAttached();
    await expect(page.getByText('16 saraketta')).toBeVisible();
  });

  test('windows-1252 CSVs and JSON', async ({ page }) => {
    await upload(page, ['tilaukset-q1.csv', 'tilaukset-q2.csv', 'tuotteet.json']);
    await expect(page.getByText('Lisättiin 3 datasettiä')).toBeVisible({ timeout: 60_000 });
    const cards = page.getByRole('list', { name: 'Lähteet' }).getByRole('listitem');
    await expect(cards).toHaveCount(3);
    await expect(cards.first()).toContainText('windows-1252');
    await cards.first().getByRole('button', { name: 'Esikatselu' }).click();
    await expect(page.getByRole('grid').getByRole('gridcell', { name: 'Päivämäärä' })).toBeVisible();
    await cards.nth(2).getByRole('button', { name: 'Esikatselu' }).click();
    await expect(page.getByRole('grid').getByRole('gridcell', { name: 'kategoria.nimi' })).toBeVisible();
  });

  test('English sample and relation CSVs', async ({ page }) => {
    await upload(page, ['sales-orders.csv', 'asiakkaat.csv', 'tilaukset.csv']);
    await expect(page.getByText('Lisättiin 3 datasettiä')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('5 000', { exact: true })).toBeVisible();
  });

  test('removing a source', async ({ page }) => {
    await upload(page, ['asiakkaat.csv']);
    await expect(page.getByText('Lisättiin 1 datasetti')).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: /^Poista lähde/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Poista' }).click();
    await expect(page.getByRole('list', { name: 'Lähteet' })).toBeHidden();
  });
});
