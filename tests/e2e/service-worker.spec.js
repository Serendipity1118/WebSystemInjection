const { test, expect } = require('./fixtures');

test.describe('Service Worker (Background)', () => {
  test('Service Workerが起動している', async ({ context }) => {
    let sw = context.serviceWorkers()[0];
    if (!sw) {
      sw = await context.waitForEvent('serviceworker');
    }
    expect(sw).toBeTruthy();
    expect(sw.url()).toContain('background.js');
  });

  test('バッジにアクティブなプラグイン数が表示される', async ({ context, extensionId }) => {
    const serviceWorker = context.serviceWorkers()[0];

    await serviceWorker.evaluate(() => {
      return chrome.storage.local.set({
        plugins: [
          {
            id: 'badge-test',
            name: 'Badge Test',
            version: '1.0.0',
            domains: ['example.com'],
            enabled: true,
            code: '',
            css: '',
            config: {},
          },
        ],
      });
    });

    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForTimeout(500);

    const tabId = await page.evaluate(() =>
      new Promise((resolve) =>
        chrome.runtime.sendMessage({ type: 'getTabId' }, (res) => resolve(res))
      )
    ).catch(() => null);

    // バッジの検証は内部APIなので、Service Worker側で確認
    const badgeText = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ active: true });
      if (tabs.length === 0) return '';
      return chrome.action.getBadgeText({ tabId: tabs[0].id });
    });

    expect(badgeText).toBe('1');
  });
});
