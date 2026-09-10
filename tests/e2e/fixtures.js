const playwright = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

const base = playwright.test;
const chromium = playwright.chromium;
const EXTENSION_PATH = path.join(__dirname, '..', '..', 'src');

function launchExtension(profileDir) {
  return chromium.launchPersistentContext(profileDir, {
    channel: 'chromium',
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });
}

async function getServiceWorker(context) {
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }
  return serviceWorker;
}

const test = base.extend({
  context: async ({}, use) => {
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsi-playwright-'));
    let context = await launchExtension(profileDir);

    const serviceWorker = await getServiceWorker(context);
    const extensionId = serviceWorker.url().split('/')[2];
    const settingsPage = await context.newPage();
    await settingsPage.goto(`chrome://extensions/?id=${extensionId}`);
    const userScriptsToggle = settingsPage.locator(
      'extensions-detail-view #allow-user-scripts'
    );
    await userScriptsToggle.waitFor();

    if (!(await userScriptsToggle.evaluate((toggle) => toggle.checked))) {
      await userScriptsToggle.click();
      await context.close();
      context = await launchExtension(profileDir);
      await getServiceWorker(context);
    } else {
      await settingsPage.close();
    }

    try {
      await use(context);
    } finally {
      await context.close();
      const resolvedProfile = path.resolve(profileDir);
      const resolvedTemp = path.resolve(os.tmpdir()) + path.sep;
      if (!resolvedProfile.startsWith(resolvedTemp)) {
        throw new Error(`Refusing to remove profile outside temp: ${resolvedProfile}`);
      }
      fs.rmSync(resolvedProfile, { recursive: true, force: true });
    }
  },

  extensionId: async ({ context }, use) => {
    const serviceWorker = await getServiceWorker(context);
    const extensionId = serviceWorker.url().split('/')[2];
    await use(extensionId);
  },
});

const expect = test.expect;

module.exports = { test, expect };
