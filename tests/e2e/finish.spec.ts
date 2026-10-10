import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function loadDemo(page: import('@playwright/test').Page, query = '') {
  await page.goto(`./${query}`);
  await page.getByTestId('demo-album').click();
  await expect(page.getByTestId('album-title')).toHaveText('Lado B do Futuro', { timeout: 30_000 });
}

test('tema muda com o gênero do álbum (RF17)', async ({ page }) => {
  await loadDemo(page);
  await expect(page.getByTestId('theme-label')).toHaveText('Tema: Eletrônica');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'electronic');
});

test('estante lista e ordena os álbuns (RF12, RF13)', async ({ page }) => {
  await loadDemo(page);
  await page.getByTestId('folder-input').setInputFiles(new URL('../fixtures/sem-tags', import.meta.url).pathname);
  const items = page.getByTestId('shelf-list').locator('li');
  await expect(items).toHaveCount(2);
  await page.getByTestId('shelf-sort').selectOption('year');
  await expect(items.first()).toContainText('Lado B do Futuro');
  // Puxar outro CD da estante troca o álbum em primeiro plano (RF14).
  await items.nth(1).getByRole('button').click();
  await expect(page.getByTestId('album-title')).toHaveText('sem-tags', { timeout: 30_000 });
});

test('fluxo completo com WebGL desativado (fallback 2D)', async ({ page }) => {
  await loadDemo(page, '?no3d');
  await expect(page.getByTestId('fallback-2d')).toBeVisible();
  for (const type of ['UNWRAP', 'OPEN', 'TAKE_DISC', 'INSERT_DISC', 'OPEN_BOOKLET']) {
    await page.locator(`[data-action="${type}"]`).click();
  }
  await page.locator('[data-action="FULLSCREEN"]').click();
  await expect(page.getByTestId('booklet-full').locator('img')).toBeVisible();
});

test('sem violações graves de acessibilidade (axe)', async ({ page }) => {
  await loadDemo(page, '?no3d');
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} ${n.failureSummary ?? ''}`.slice(0, 300)))).toEqual([]);
});

test.describe('testes visuais da caixa', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Baseline só no Chromium; WebGL difere entre motores');

  test('caixa fechada, aberta e encarte', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await loadDemo(page);
    const stage = page.getByTestId('stage');
    await page.locator('[data-action="UNWRAP"]').click();
    await page.waitForTimeout(800);
    await expect(stage).toHaveScreenshot('caixa-fechada.png');
    await page.locator('[data-action="OPEN"]').click();
    await page.waitForTimeout(800);
    await expect(stage).toHaveScreenshot('caixa-aberta.png');
    await page.locator('[data-action="OPEN_BOOKLET"]').click();
    await page.waitForTimeout(800);
    await expect(stage).toHaveScreenshot('encarte.png');
  });
});
