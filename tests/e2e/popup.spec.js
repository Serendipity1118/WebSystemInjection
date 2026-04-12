const { test, expect } = require('./fixtures');
const path = require('path');
const fs = require('fs');
const { createPluginZip, samplePluginDef, SAMPLE_MAIN_JS } = require('./helpers');

test.describe('ポップアップUI', () => {
  test('ポップアップが正しくレンダリングされる', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

    await expect(page.locator('.header__title')).toHaveText('WSI');
    await expect(page.locator('.header__subtitle')).toHaveText('Web System Injection');
    await expect(page.locator('#empty-message')).toBeVisible();
    await expect(page.locator('#plugin-count')).toHaveText('0');
    await expect(page.locator('#add-plugin-btn')).toBeVisible();
  });

  test('「プラグインを追加」でインポート画面に遷移する', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

    await page.click('#add-plugin-btn');
    await expect(page.locator('#import-view')).toBeVisible();
    await expect(page.locator('#main-view')).toBeHidden();
    await expect(page.locator('.drop-zone')).toBeVisible();
  });

  test('戻るボタンでメイン画面に戻る', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

    await page.click('#add-plugin-btn');
    await expect(page.locator('#import-view')).toBeVisible();

    await page.click('#back-btn');
    await expect(page.locator('#main-view')).toBeVisible();
    await expect(page.locator('#import-view')).toBeHidden();
  });

  test('ZIPをインポートしてプラグインが一覧に表示される', async ({ page, extensionId }) => {
    const pluginDef = samplePluginDef();
    const zipBuffer = await createPluginZip(pluginDef, SAMPLE_MAIN_JS);
    const tmpZip = path.join(__dirname, 'tmp-test-plugin.zip');
    fs.writeFileSync(tmpZip, zipBuffer);

    try {
      await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      await page.click('#add-plugin-btn');

      const fileInput = page.locator('#file-input');
      await fileInput.setInputFiles(tmpZip);

      await expect(page.locator('#preview-section')).toBeVisible();
      await expect(page.locator('#preview-content')).toContainText('Test Plugin');
      await expect(page.locator('#preview-content')).toContainText('example.com');

      await page.click('#import-btn');

      await expect(page.locator('#main-view')).toBeVisible();
      await expect(page.locator('#plugin-count')).toHaveText('1');
      await expect(page.locator('.plugin-card__name')).toHaveText('Test Plugin');
      await expect(page.locator('.plugin-card__domains')).toContainText('example.com');
    } finally {
      fs.unlinkSync(tmpZip);
    }
  });

  test('不正なZIPでエラーメッセージが表示される', async ({ page, extensionId }) => {
    const zip = require('jszip');
    const z = new zip();
    z.file('readme.txt', 'no plugin.json here');
    const buf = await z.generateAsync({ type: 'nodebuffer' });
    const tmpZip = path.join(__dirname, 'tmp-bad-plugin.zip');
    fs.writeFileSync(tmpZip, buf);

    try {
      await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      await page.click('#add-plugin-btn');

      const fileInput = page.locator('#file-input');
      await fileInput.setInputFiles(tmpZip);

      await expect(page.locator('#error-section')).toBeVisible();
      await expect(page.locator('#error-message')).toContainText('plugin.json');
    } finally {
      fs.unlinkSync(tmpZip);
    }
  });

  test('プラグインの有効/無効を切り替えられる', async ({ page, extensionId, context }) => {
    const serviceWorker = context.serviceWorkers()[0];
    await serviceWorker.evaluate(() => {
      return chrome.storage.local.set({
        plugins: [
          {
            id: 'toggle-test',
            name: 'Toggle Test',
            version: '1.0.0',
            description: 'トグルテスト',
            domains: ['example.com'],
            enabled: true,
            code: 'console.log("hello")',
            css: '',
            config: {},
            installedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });
    });

    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

    const toggle = page.locator('.toggle input[type="checkbox"]');
    await expect(toggle).toBeChecked();

    await page.locator('.toggle__slider').click();
    await expect(toggle).not.toBeChecked();

    const result = await serviceWorker.evaluate(() =>
      chrome.storage.local.get('plugins')
    );
    expect(result.plugins[0].enabled).toBe(false);
  });

  test('プラグインを削除できる', async ({ page, extensionId, context }) => {
    const serviceWorker = context.serviceWorkers()[0];
    await serviceWorker.evaluate(() => {
      return chrome.storage.local.set({
        plugins: [
          {
            id: 'delete-test',
            name: 'Delete Test',
            version: '1.0.0',
            description: '削除テスト',
            domains: ['example.com'],
            enabled: true,
            code: '',
            css: '',
            config: {},
            installedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });
    });

    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await expect(page.locator('.plugin-card')).toHaveCount(1);

    page.on('dialog', (dialog) => dialog.accept());

    await page.click('.delete-btn');

    await expect(page.locator('.plugin-card')).toHaveCount(0);
    await expect(page.locator('#plugin-count')).toHaveText('0');
    await expect(page.locator('#empty-message')).toBeVisible();
  });
});
