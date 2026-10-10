import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const demoDir = fileURLToPath(new URL('../../public/demo', import.meta.url));
const untaggedDir = fileURLToPath(new URL('../fixtures/sem-tags', import.meta.url));

async function canPlayMp3(page: Page): Promise<boolean> {
  return page.evaluate(() => document.createElement('audio').canPlayType('audio/mpeg') !== '');
}

/** Registra toda requisição com corpo: nenhuma pode carregar áudio (RF16). */
function watchUploads(page: Page): string[] {
  const offenders: string[] = [];
  page.on('request', (req) => {
    const body = req.postDataBuffer();
    if (req.method() !== 'GET' && body && body.length > 0) offenders.push(`${req.method()} ${req.url()} (${body.length} bytes)`);
  });
  return offenders;
}

async function action(page: Page, type: string) {
  const btn = page.locator(`[data-testid="scene-actions"] [data-action="${type}"]`);
  await expect(btn).toBeVisible();
  await btn.click();
}

test.describe('critério de sucesso do PRD', () => {
  test('carregar pasta, tirar plástico, abrir, tirar disco, tocar, folhear encarte', async ({ page }) => {
    const uploads = watchUploads(page);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('./');
    await page.getByTestId('folder-input').setInputFiles(demoDir);

    await page.waitForTimeout(2000);
    expect(errors, 'erros no console').toEqual([]);
    await expect(page.getByTestId('album-title')).toHaveText('Lado B do Futuro');
    // A faixa oculta (faixa 0) fica fora da tracklist visível.
    await expect(page.getByTestId('tracklist').locator('li')).toHaveCount(4);
    await expect(page.getByTestId('tracklist').locator('li').first()).toContainText('Luz de Tubo');

    await action(page, 'UNWRAP');
    await action(page, 'OPEN');
    await action(page, 'TAKE_DISC');
    await action(page, 'INSERT_DISC');
    await expect(page.getByTestId('announcer')).toHaveText(/Disco no aparelho|Tocando faixa 1/);
    if (await canPlayMp3(page)) {
      await expect(page.getByTestId('play')).toHaveAttribute('aria-label', 'Pausar', { timeout: 15_000 });
    }

    await action(page, 'OPEN_BOOKLET');
    await expect(page.getByTestId('announcer')).toHaveText(/Encarte aberto|Tocando/);
    await action(page, 'NEXT_PAGE');
    await action(page, 'FULLSCREEN');
    await expect(page.getByTestId('booklet-full')).toBeVisible();
    await expect(page.getByTestId('booklet-full').locator('img')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('booklet-full')).toBeHidden();

    expect(uploads).toEqual([]);
  });

  test('o mesmo fluxo só com teclado', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('demo-album').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('album-title')).toHaveText('Lado B do Futuro');
    await expect(page.locator('[data-action="UNWRAP"]')).toBeVisible();

    const scene = page.getByTestId('canvas-wrap');
    if (await scene.count()) {
      await scene.focus();
      // Enter: tirar plástico, abrir, tirar disco, tocar, abrir encarte.
      for (const expected of ['OPEN', 'TAKE_DISC', 'INSERT_DISC', 'OPEN_BOOKLET', 'CLOSE_BOOKLET']) {
        await page.keyboard.press('Enter');
        await expect(page.locator(`[data-action="${expected}"]`)).toBeVisible();
      }
      // Esc volta um estado: fecha o encarte antes de ejetar.
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-action="OPEN_BOOKLET"]')).toBeVisible();
    } else {
      // Sem WebGL: os mesmos passos pelos botões, navegando com Tab e Enter.
      for (const type of ['UNWRAP', 'OPEN', 'TAKE_DISC', 'INSERT_DISC', 'OPEN_BOOKLET']) {
        await page.locator(`[data-action="${type}"]`).focus();
        await page.keyboard.press('Enter');
      }
      await expect(page.locator('[data-action="CLOSE_BOOKLET"]')).toBeVisible();
    }
  });

  test('arquivo sem tags vira álbum pelo nome da pasta', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('folder-input').setInputFiles(untaggedDir);
    await expect(page.getByTestId('album-title')).toHaveText('sem-tags');
  });
});
