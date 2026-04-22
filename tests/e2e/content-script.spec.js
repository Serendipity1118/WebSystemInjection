const { test, expect } = require('./fixtures');

test.describe('Content Script 注入', () => {
  test('マッチするドメインでプラグインが実行される', async ({ context, extensionId }) => {
    const serviceWorker = context.serviceWorkers()[0];
    await serviceWorker.evaluate(() => {
      return chrome.storage.local.set({
        plugins: [
          {
            id: 'inject-test',
            name: 'Inject Test',
            version: '1.0.0',
            description: '',
            domains: ['example.com'],
            enabled: true,
            code: `
              const marker = document.createElement('div');
              marker.id = 'wsi-inject-marker';
              marker.textContent = 'WSI Injected';
              document.body.appendChild(marker);
            `,
            css: '',
            config: {},
            installedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });
    });

    const page = await context.newPage();
    await page.goto('https://example.com');

    await expect(page.locator('#wsi-inject-marker')).toBeVisible();
    await expect(page.locator('#wsi-inject-marker')).toHaveText('WSI Injected');
  });

  test('マッチしないドメインではプラグインが実行されない', async ({ context, extensionId }) => {
    const serviceWorker = context.serviceWorkers()[0];
    await serviceWorker.evaluate(() => {
      return chrome.storage.local.set({
        plugins: [
          {
            id: 'no-match-test',
            name: 'No Match Test',
            version: '1.0.0',
            description: '',
            domains: ['other-domain.com'],
            enabled: true,
            code: `
              const marker = document.createElement('div');
              marker.id = 'wsi-no-match-marker';
              document.body.appendChild(marker);
            `,
            css: '',
            config: {},
            installedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });
    });

    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForTimeout(1000);

    await expect(page.locator('#wsi-no-match-marker')).toHaveCount(0);
  });

  test('無効なプラグインは実行されない', async ({ context, extensionId }) => {
    const serviceWorker = context.serviceWorkers()[0];
    await serviceWorker.evaluate(() => {
      return chrome.storage.local.set({
        plugins: [
          {
            id: 'disabled-test',
            name: 'Disabled Test',
            version: '1.0.0',
            description: '',
            domains: ['example.com'],
            enabled: false,
            code: `
              const marker = document.createElement('div');
              marker.id = 'wsi-disabled-marker';
              document.body.appendChild(marker);
            `,
            css: '',
            config: {},
            installedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });
    });

    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForTimeout(1000);

    await expect(page.locator('#wsi-disabled-marker')).toHaveCount(0);
  });

  test('CSSが正しく注入される', async ({ context, extensionId }) => {
    const serviceWorker = context.serviceWorkers()[0];
    await serviceWorker.evaluate(() => {
      return chrome.storage.local.set({
        plugins: [
          {
            id: 'css-test',
            name: 'CSS Test',
            version: '1.0.0',
            description: '',
            domains: ['example.com'],
            enabled: true,
            code: '',
            css: 'body { border-top: 3px solid rgb(255, 0, 0) !important; }',
            config: {},
            installedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });
    });

    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForTimeout(1000);

    const borderTop = await page.evaluate(() =>
      getComputedStyle(document.body).borderTopColor
    );
    expect(borderTop).toBe('rgb(255, 0, 0)');
  });

  test('"*" ワイルドカードドメインで任意のサイトでプラグインが実行される', async ({ context }) => {
    const serviceWorker = context.serviceWorkers()[0];
    await serviceWorker.evaluate(() => {
      return chrome.storage.local.set({
        plugins: [
          {
            id: 'wildcard-test',
            name: 'Wildcard Test',
            version: '1.0.0',
            description: '',
            domains: ['*'],
            enabled: true,
            code: `
              const marker = document.createElement('div');
              marker.id = 'wsi-wildcard-marker';
              marker.textContent = 'WSI Wildcard Injected';
              document.body.appendChild(marker);
            `,
            css: '',
            config: {},
            installedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });
    });

    const page = await context.newPage();

    // 1つ目のドメイン
    await page.goto('https://example.com');
    await expect(page.locator('#wsi-wildcard-marker')).toBeVisible();
    await expect(page.locator('#wsi-wildcard-marker')).toHaveText('WSI Wildcard Injected');

    // 異なるドメインでも同じプラグインが実行されることを確認（"*" が個別ドメインに依存しない証左）
    await page.goto('https://example.org');
    await expect(page.locator('#wsi-wildcard-marker')).toBeVisible();
    await expect(page.locator('#wsi-wildcard-marker')).toHaveText('WSI Wildcard Injected');
  });

  test('SDKのaddButtonでフローティングボタンが追加される', async ({ context, extensionId }) => {
    const serviceWorker = context.serviceWorkers()[0];
    await serviceWorker.evaluate(() => {
      return chrome.storage.local.set({
        plugins: [
          {
            id: 'button-test',
            name: 'Button Test',
            version: '1.0.0',
            description: '',
            domains: ['example.com'],
            enabled: true,
            code: `
              WSI.addButton({
                text: "WSI Button",
                position: "bottom-right",
                onClick: () => {
                  document.title = "Button Clicked";
                }
              });
            `,
            css: '',
            config: {},
            installedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });
    });

    const page = await context.newPage();
    await page.goto('https://example.com');

    const btn = page.locator('.wsi-floating-button');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('WSI Button');

    await btn.click();
    await expect(page).toHaveTitle('Button Clicked');
  });
});
