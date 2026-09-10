const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const pluginCode = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');

async function run() {
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('https://www.mgstage.com/**', (route) => route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head>
        <link rel="canonical" href="https://www.mgstage.com/product/product_detail/ABF-319/">
        </head><body><table><tbody>
        <tr id="duration"><th>収録時間：</th><td>140min</td></tr>
        <tr id="product-number"><th>品番：</th><td>ABF-319</td></tr>
        <tbody></table></body></html>`,
    }));
    await page.goto('https://www.mgstage.com/product/product_detail/ABF-319/');
    await page.addScriptTag({ content: `const WSI = { fetch: async () => ({ ok: true }), log: () => {} };\n${pluginCode}` });
    await page.locator('#wsi-missav-row').waitFor();
    const desktop = await page.locator('#wsi-missav-row').evaluate((row) => ({
      tag: row.tagName,
      previousId: row.previousElementSibling?.id,
      href: row.querySelector('a')?.href,
    }));
    if (desktop.tag !== 'TR' || desktop.previousId !== 'product-number'
      || desktop.href !== 'https://missav.ai/ja/ABF-319') {
      throw new Error(`Desktop layout regression: ${JSON.stringify(desktop)}`);
    }

    await page.route('https://sp.mgstage.com/**', (route) => route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head>
        <link rel="canonical" href="https://www.mgstage.com/product/product_detail/ABF-319/">
        </head><body><dl>
        <dt>収録時間</dt><dd>140分</dd>
        <dt id="product-label">品番</dt><dd id="product-number-mobile">SP-ABF-319</dd>
        </dl></body></html>`,
    }));
    await page.goto('https://sp.mgstage.com/product/product_detail/SP-ABF-319/');
    await page.addScriptTag({ content: `const WSI = { fetch: async () => ({ ok: true }), log: () => {} };\n${pluginCode}` });
    await page.locator('#wsi-missav-row').waitFor();
    const mobile = await page.locator('#wsi-missav-row').evaluate((row) => ({
      tag: row.tagName,
      label: row.previousElementSibling?.textContent,
      previousValueId: row.previousElementSibling?.previousElementSibling?.id,
      href: row.querySelector('a')?.href,
    }));
    if (mobile.tag !== 'DD' || mobile.label !== 'MISSAV'
      || mobile.previousValueId !== 'product-number-mobile'
      || mobile.href !== 'https://missav.ai/ja/ABF-319') {
      throw new Error(`Mobile layout failure: ${JSON.stringify(mobile)}`);
    }

    console.log('PC and mobile layout verification passed.');
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
