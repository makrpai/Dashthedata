import { expect, test } from '@playwright/test';

test.describe('automatic dashboard (phase 5)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await page.goto('/workspace/data');
    await page.getByRole('button', { name: 'Kokeile esimerkkidatalla' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Tuo valitut' }).click();
    await expect(page).toHaveURL(/\/workspace\/transform\//, { timeout: 60_000 });
    await page
      .getByRole('navigation', { name: 'Päävalikko' })
      .getByRole('link', { name: /^Dashboardit/ })
      .click();
    await expect(page).toHaveURL(/\/workspace\/dashboards\/.+/, { timeout: 60_000 });
    const tileMenuButtons = page.getByRole('button', { name: /^Kaavion toiminnot/ });
    if ((await tileMenuButtons.count()) === 0) {
      await page.getByRole('button', { name: 'Luo dashboard automaattisesti' }).click();
    }
    await expect(page.getByRole('button', { name: /^Kaavion toiminnot/ }).first()).toBeVisible({ timeout: 30_000 });
  });

  test('sample data creates a dashboard with KPIs, a trend and reasons', async ({ page }) => {
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

  test('dragging, resizing and cross-filtering work end-to-end (phase 6 scenarios 1–3)', async ({ page }) => {
    const tile = page.getByRole('article', { name: 'Myynti ajan mukaan', exact: true });
    await expect(tile).toBeVisible();
    const beforeBox = await tile.boundingBox();
    if (!beforeBox) throw new Error('Tile is not visible');

    // Clicking a button in the tile header must not start drag.
    await tile.getByRole('button', { name: /^Kaavion toiminnot/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Muokkaa' })).toBeVisible();
    await page.keyboard.press('Escape');

    // Drag by the configured handle.
    const dragHandle = tile.locator('.dtd-tile-drag').first();
    const dragBox = await dragHandle.boundingBox();
    if (!dragBox) throw new Error('Drag handle is not visible');
    await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + Math.min(18, dragBox.height / 2));
    await page.mouse.down();
    await page.mouse.move(dragBox.x + dragBox.width / 2 + 180, dragBox.y + Math.min(18, dragBox.height / 2) + 40, {
      steps: 10,
    });
    await page.mouse.up();
    await expect
      .poll(async () => {
        const moved = await tile.boundingBox();
        if (!moved) return 0;
        return Math.abs(moved.x - beforeBox.x) + Math.abs(moved.y - beforeBox.y);
      })
      .toBeGreaterThan(10);

    // Resize from the south-east handle.
    const beforeResize = await tile.boundingBox();
    if (!beforeResize) throw new Error('Tile is not visible before resizing');
    await tile.hover();
    const resizeHandle = tile.locator('.react-resizable-handle').first();
    const resizeHandleEl = await resizeHandle.elementHandle({ timeout: 1000 }).catch(() => null);
    const resizeBox = resizeHandleEl ? await resizeHandleEl.boundingBox() : null;
    if (resizeBox) {
      await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(resizeBox.x + resizeBox.width / 2 + 110, resizeBox.y + resizeBox.height / 2 + 70, {
        steps: 8,
      });
      await page.mouse.up();
    } else {
      await tile.getByRole('button', { name: /^Kaavion toiminnot/ }).click();
      await page.getByRole('menuitem', { name: 'Kasvata' }).click();
    }
    await expect
      .poll(async () => {
        const resized = await tile.boundingBox();
        if (!resized) return 0;
        return Math.round((resized.width - beforeResize.width) + (resized.height - beforeResize.height));
      })
      .toBeGreaterThan(10);

    // Cross-filter via chart click and clear with Esc and chip button.
    const source = page.getByRole('article', { name: 'Myynti / Alue', exact: true });
    const target = page.getByRole('article', { name: 'Myynti / Tuoteryhmä', exact: true });
    const targetChart = target.getByRole('img').first();
    const targetBefore = await targetChart.getAttribute('aria-label');
    const chart = source.getByRole('img').first();
    const chartBox = await chart.boundingBox();
    if (!chartBox) throw new Error('Source chart is not visible');
    let crossFilterSet = false;
    for (const yRatio of [0.75, 0.6, 0.45, 0.3]) {
      for (const xRatio of [0.12, 0.24, 0.36, 0.5, 0.64, 0.78, 0.9]) {
        await page.mouse.click(chartBox.x + chartBox.width * xRatio, chartBox.y + chartBox.height * yRatio);
        try {
          await expect(page.getByRole('button', { name: 'Poista valinta' })).toBeVisible({ timeout: 500 });
          crossFilterSet = true;
          break;
        } catch {
          // Keep scanning the chart area.
        }
      }
      if (crossFilterSet) break;
    }
    expect(crossFilterSet).toBeTruthy();
    await expect(page.getByRole('button', { name: 'Poista valinta' })).toBeVisible();
    await expect
      .poll(() => targetChart.getAttribute('aria-label'))
      .not.toBe(targetBefore);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Poista valinta' })).toBeHidden();

    // Global date filter and screenshots in both themes.
    const filterBar = page.getByRole('toolbar', { name: 'Suodattimet' });
    const dateFilterButton = filterBar.locator('button').filter({ hasText: /Kaikki/ }).first();
    await dateFilterButton.click();
    await page.getByRole('button', { name: 'Tämä vuosi' }).click();
    await expect(filterBar.getByRole('button', { name: 'Tyhjennä suodattimet' }).first()).toBeVisible();

    await page.screenshot({ path: 'test-results/phase6-dashboard-light.png', fullPage: true });
    await page.getByRole('button', { name: 'Vaihda teemaa' }).click();
    await page.getByRole('menuitemradio', { name: 'Yö' }).click();
    await page.screenshot({ path: 'test-results/phase6-dashboard-dark.png', fullPage: true });
  });

  test('dashboard state persists after reload (phase 6 scenario 8)', async ({ page }) => {
    const tile = page.getByRole('article', { name: 'Myynti ajan mukaan', exact: true });
    await expect(tile).toBeVisible();
    const beforeLayout = await tile.boundingBox();
    if (!beforeLayout) throw new Error('Tile not visible before drag');
    const dragHandle = tile.locator('.dtd-tile-drag').first();
    const dragBox = await dragHandle.boundingBox();
    if (!dragBox) throw new Error('Drag handle is not visible');
    await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + Math.min(18, dragBox.height / 2));
    await page.mouse.down();
    await page.mouse.move(dragBox.x + dragBox.width / 2 + 140, dragBox.y + Math.min(18, dragBox.height / 2) + 35, {
      steps: 8,
    });
    await page.mouse.up();
    const movedLayout = await tile.boundingBox();
    if (!movedLayout) throw new Error('Tile not visible after drag');
    expect(Math.abs(movedLayout.x - beforeLayout.x) + Math.abs(movedLayout.y - beforeLayout.y)).toBeGreaterThan(10);
    await page.waitForTimeout(1400);

    await page.reload();
    const restored = page.getByRole('article', { name: 'Myynti ajan mukaan', exact: true });
    await expect(restored).toBeVisible();
    await expect
      .poll(async () => {
        const box = await restored.boundingBox();
        if (!box) return 0;
        return Math.abs(box.x - beforeLayout.x) + Math.abs(box.y - beforeLayout.y);
      })
      .toBeGreaterThan(10);
  });
});
