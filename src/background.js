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
  if (message.type === 'WSI_USER_SCRIPTS_STATUS') {
    isUserScriptsAvailable().then((available) => sendResponse({ available }));
    return true;
  }
  if (message.type === 'WSI_STORAGE_REQUEST' && sender.tab) {
    handleStorageRequest(message).then(sendResponse);
    return true;
  }
  if (message.type === 'WSI_FETCH_REQUEST' && sender.tab) {
    handleFetchRequest(message, sender).then(sendResponse);
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
      (plugin) => plugin.enabled && matchesDomain(hostname, plugin.domains)
    );
    if (matched.length === 0) return;

    if (!(await isUserScriptsAvailable())) {
      console.warn('[WSI] User Scripts API is disabled. Enable "Allow User Scripts" in the extension details.');
      return;
    }

    for (const plugin of matched) {
      try {
        const result = await runPluginInTab(tabId, plugin);
        if (result && !result.ok) {
          if (result.reason === 'already-ran') continue;
          console.error(`[WSI] Plugin runtime error (${plugin.id}): ${result.reason}`);
          continue;
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

async function isUserScriptsAvailable() {
  try {
    if (!chrome.userScripts) return false;
    await chrome.userScripts.getScripts();
    return true;
  } catch {
    return false;
  }
}

// SDK コアは packages/wsi_sdk (WSIBrowser リポジトリ) から生成したバンドル。
// パッケージ内SDKとユーザー提供コードを、許可された User Scripts API でMAINワールドへ渡す。
const SDK_FILE = 'sdk/wsi-sdk.js';

function createPluginInvocation(plugin) {
  const spec = JSON.stringify({
    pluginId: plugin.id,
    config: plugin.config || {},
    permissions: plugin.permissions,
    context: 'page',
    code: plugin.code || '',
  });
  const pluginId = JSON.stringify(plugin.id);
  const css = JSON.stringify(plugin.css || '');

  return `(() => {
    const pluginId = ${pluginId};
    const css = ${css};
    if (css && !document.querySelector('style[data-wsi-plugin-id="' + pluginId + '"]')) {
      const style = document.createElement('style');
      style.dataset.wsiPluginId = pluginId;
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    }
    return globalThis.__wsiRun(${spec});
  })();`;
}

async function runPluginInTab(tabId, plugin) {
  const results = await chrome.userScripts.execute({
    target: { tabId },
    js: [
      { file: SDK_FILE },
      { code: createPluginInvocation(plugin) },
    ],
    world: 'MAIN',
  });
  const result = results[results.length - 1];
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

function resolveFetchReferrer(options, sender) {
  if (typeof options.referrer === 'string' && options.referrer) return options.referrer;
  const headers = options.headers || {};
  const fromHeader = headers.Referer || headers.referer;
  if (typeof fromHeader === 'string' && fromHeader) return fromHeader;
  if (sender?.tab?.url && /^https?:\/\//.test(sender.tab.url)) return sender.tab.url;
  return undefined;
}

function sanitizeFetchHeaders(headers) {
  if (!headers || typeof headers !== 'object') return undefined;
  const out = { ...headers };
  delete out.Referer;
  delete out.referer;
  return Object.keys(out).length > 0 ? out : undefined;
}

// Referer 注入用の DNR ルール ID 帯。並列 fetch で 1 本のルールを共有すると、先に終わった
// リクエストの削除で後続が Referer なしになり CDN が 403 を返すため、(host, referrer) ごとに
// ルールを持ち、使用中のリクエストが 0 になった時点で削除する。
const REFERER_RULE_ID_MIN = 900001;
const REFERER_RULE_ID_MAX = 900100;

/** @type {Map<string, { id: number, count: number, ready: Promise<void> }>} */
const refererRules = new Map();
let refererRulesInit = null;
let dnrQueue = Promise.resolve();

// updateDynamicRules の追加・削除が前後しないよう直列化する
function queueDynamicRules(update) {
  const p = dnrQueue.then(() => chrome.declarativeNetRequest.updateDynamicRules(update));
  dnrQueue = p.catch(() => {});
  return p;
}

// Service Worker 再起動前のルールが残っていると ID が衝突するので最初に掃除する
function initRefererRules() {
  refererRulesInit ??= (async () => {
    try {
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      const stale = rules
        .map((r) => r.id)
        .filter((id) => id >= REFERER_RULE_ID_MIN && id <= REFERER_RULE_ID_MAX);
      if (stale.length > 0) await queueDynamicRules({ removeRuleIds: stale });
    } catch {
      // ignore cleanup errors
    }
  })();
  return refererRulesInit;
}

function allocateRefererRuleId() {
  const used = new Set([...refererRules.values()].map((e) => e.id));
  for (let id = REFERER_RULE_ID_MIN; id <= REFERER_RULE_ID_MAX; id++) {
    if (!used.has(id)) return id;
  }
  return null;
}

async function acquireRefererRule(host, referrer) {
  await initRefererRules();
  const key = `${host} ${referrer}`;
  let entry = refererRules.get(key);
  if (!entry) {
    const id = allocateRefererRuleId();
    if (id === null) return null;
    entry = {
      id,
      count: 0,
      ready: queueDynamicRules({
        removeRuleIds: [id],
        addRules: [{
          id,
          priority: 1,
          action: {
            type: 'modifyHeaders',
            requestHeaders: [
              { header: 'Referer', operation: 'set', value: referrer },
            ],
          },
          condition: {
            urlFilter: `||${host}^`,
            initiatorDomains: [chrome.runtime.id],
            resourceTypes: ['xmlhttprequest', 'other'],
          },
        }],
      }),
    };
    refererRules.set(key, entry);
  }
  entry.count += 1;
  try {
    await entry.ready;
  } catch (err) {
    releaseRefererRule(key);
    throw err;
  }
  return key;
}

function releaseRefererRule(key) {
  const entry = refererRules.get(key);
  if (!entry) return;
  entry.count -= 1;
  if (entry.count > 0) return;
  refererRules.delete(key);
  queueDynamicRules({ removeRuleIds: [entry.id] }).catch(() => {
    // ignore cleanup errors
  });
}

async function withRefererHeader(referrer, targetUrl, run) {
  if (!referrer || !chrome.declarativeNetRequest?.updateDynamicRules) {
    return run();
  }
  let host = '';
  try {
    host = new URL(targetUrl).hostname;
  } catch {
    return run();
  }
  const key = await acquireRefererRule(host, referrer);
  try {
    return await run();
  } finally {
    if (key) releaseRefererRule(key);
  }
}

async function handleFetchRequest(message, sender) {
  const { url, options = {} } = message;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  try {
    const method = (options.method || 'HEAD').toUpperCase();
    const timeoutMs = Number(options.timeoutMs);
    if (controller && timeoutMs > 0) {
      timer = setTimeout(() => controller.abort(), timeoutMs);
    }
    const referrer = resolveFetchReferrer(options, sender);
    const fetchInit = {
      method,
      redirect: options.redirect || 'follow',
      headers: sanitizeFetchHeaders(options.headers),
      body: options.body,
      // v2: credentials 'site' はサイトの Cookie を送る。既定 (omit) は送らない
      credentials: options.credentials === 'site' ? 'include' : 'omit',
      signal: controller ? controller.signal : undefined,
    };
    if (referrer) {
      fetchInit.referrer = referrer;
      fetchInit.referrerPolicy = options.referrerPolicy || 'unsafe-url';
    }
    const res = await withRefererHeader(referrer, url, () => fetch(url, fetchInit));
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
      (plugin) => plugin.enabled && matchesDomain(hostname, plugin.domains)
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
