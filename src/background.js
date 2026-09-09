chrome.runtime.onInstalled.addListener(() => {
  console.log('[WSI] Web System Injection installed');
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateBadge(tabId, tab.url);
    injectPlugins(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    updateBadge(activeInfo.tabId, tab.url);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'WSI_STORAGE_REQUEST' && sender.tab) {
    handleStorageRequest(message).then(sendResponse);
    return true;
  }
  if (message.type === 'WSI_FETCH_REQUEST' && sender.tab) {
    handleFetchRequest(message).then(sendResponse);
    return true;
  }
});

async function injectPlugins(tabId, url) {
  try {
    const hostname = new URL(url).hostname;
    if (!hostname) return;

    const { wsiEnabled = true } = await chrome.storage.local.get('wsiEnabled');
    if (!wsiEnabled) return;

    const { plugins = [] } = await chrome.storage.local.get('plugins');
    const matched = plugins.filter(
      (p) => p.enabled && matchesDomain(hostname, p.domains)
    );

    for (const plugin of matched) {
      try {
        if (plugin.css) {
          await chrome.scripting.insertCSS({
            target: { tabId },
            css: plugin.css,
          });
        }

        if (plugin.code) {
          const result = await runPluginInTab(tabId, plugin);
          if (result && !result.ok) {
            if (result.reason === 'already-ran') continue;
            console.error(`[WSI] Plugin runtime error (${plugin.id}): ${result.reason}`);
            continue;
          }
        }

        console.log(`[WSI] Plugin injected: ${plugin.name} (${plugin.id})`);
      } catch (err) {
        console.error(`[WSI] Plugin injection error (${plugin.id}):`, err);
      }
    }
  } catch {
    // chrome:// や edge:// 等のURLではエラーになるため無視
  }
}

// SDK コアは packages/wsi_sdk (WSIBrowser リポジトリ) から生成した src/sdk/wsi-sdk.js。
// MAIN ワールドに読み込むと globalThis.__wsiRun(spec) が定義される。
const SDK_FILE = 'sdk/wsi-sdk.js';

async function runPluginInTab(tabId, plugin) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [SDK_FILE],
    world: 'MAIN',
  });
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (spec) => globalThis.__wsiRun(spec),
    args: [
      {
        pluginId: plugin.id,
        config: plugin.config || {},
        code: plugin.code,
        permissions: plugin.permissions,
        context: 'page',
      },
    ],
    world: 'MAIN',
  });
  return result && result.result;
}

async function handleStorageRequest(message) {
  const { pluginId, action, key, value } = message;
  const storageKey = `pluginData_${pluginId}`;
  const data = await chrome.storage.local.get(storageKey);
  const store = data[storageKey] || {};

  switch (action) {
    case 'get':
      return store[key];
    case 'set':
      store[key] = value;
      await chrome.storage.local.set({ [storageKey]: store });
      return true;
    case 'remove':
      delete store[key];
      await chrome.storage.local.set({ [storageKey]: store });
      return true;
    case 'getAll':
      return store;
  }
}

async function handleFetchRequest(message) {
  const { url, options = {} } = message;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  try {
    const method = (options.method || 'HEAD').toUpperCase();
    const timeoutMs = Number(options.timeoutMs);
    if (controller && timeoutMs > 0) {
      timer = setTimeout(() => controller.abort(), timeoutMs);
    }
    const res = await fetch(url, {
      method,
      redirect: options.redirect || 'follow',
      headers: options.headers,
      body: options.body,
      // v2: credentials 'site' はサイトの Cookie を送る。既定 (omit) は送らない
      credentials: options.credentials === 'site' ? 'include' : 'omit',
      signal: controller ? controller.signal : undefined,
    });
    // HEAD はボディを持たないので読まない。GET/POST/PUT/PATCH/DELETE 時のみ取得
    let body = '';
    let bodyEncoding;
    if (method !== 'HEAD') {
      const type = options.responseType || 'text';
      if (type === 'json') {
        body = await res.json();
      } else if (type === 'arraybuffer') {
        const buf = new Uint8Array(await res.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) {
          bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        }
        body = btoa(bin);
        bodyEncoding = 'base64';
      } else {
        body = await res.text();
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      url: res.url,
      redirected: res.redirected,
      body,
      ...(bodyEncoding ? { bodyEncoding } : {}),
    };
  } catch (err) {
    return { error: err.message, ok: false, status: 0 };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function updateBadge(tabId, url) {
  try {
    const hostname = new URL(url).hostname;
    const { wsiEnabled = true } = await chrome.storage.local.get('wsiEnabled');

    if (!wsiEnabled) {
      await chrome.action.setBadgeText({ text: 'OFF', tabId });
      await chrome.action.setBadgeBackgroundColor({ color: '#999', tabId });
      return;
    }

    const { plugins = [] } = await chrome.storage.local.get('plugins');
    const matchCount = plugins.filter(
      (p) => p.enabled && matchesDomain(hostname, p.domains)
    ).length;

    await chrome.action.setBadgeText({
      text: matchCount > 0 ? String(matchCount) : '',
      tabId,
    });
    await chrome.action.setBadgeBackgroundColor({ color: '#4688F1', tabId });
  } catch {
    // ignore
  }
}

function matchesDomain(hostname, domains) {
  return domains.some((pattern) => {
    if (pattern === '*') return true;
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2);
      return hostname === suffix || hostname.endsWith('.' + suffix);
    }
    return hostname === pattern;
  });
}
