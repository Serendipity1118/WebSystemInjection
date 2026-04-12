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
          await chrome.scripting.executeScript({
            target: { tabId },
            func: executePluginCode,
            args: [plugin.id, plugin.config || {}, plugin.code],
            world: 'MAIN',
          });
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

function executePluginCode(pluginId, config, code) {
  const WSI = {
    _pluginId: pluginId,
    _config: config,

    addButton(options) {
      const btn = document.createElement('button');
      btn.textContent = options.icon
        ? `${options.icon} ${options.text || ''}`
        : options.text || '';
      btn.className = 'wsi-floating-button';
      const pos = options.position || 'bottom-right';
      const posMap = {
        'bottom-right': { bottom: '20px', right: '20px' },
        'bottom-left': { bottom: '20px', left: '20px' },
        'top-right': { top: '20px', right: '20px' },
        'top-left': { top: '20px', left: '20px' },
      };
      Object.assign(btn.style, {
        position: 'fixed',
        zIndex: '2147483647',
        padding: '10px 16px',
        border: 'none',
        borderRadius: '8px',
        background: '#4688F1',
        color: '#fff',
        fontSize: '14px',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        ...(posMap[pos] || posMap['bottom-right']),
      });
      if (options.onClick) btn.addEventListener('click', options.onClick);
      document.body.appendChild(btn);
      this.log('Button added');
      return btn;
    },

    addPanel(options) {
      const panel = document.createElement('div');
      panel.className = 'wsi-panel';
      const position = options.position || 'right';
      Object.assign(panel.style, {
        position: 'fixed',
        top: '0',
        [position]: '0',
        width: options.width || '300px',
        height: '100vh',
        zIndex: '2147483646',
        background: '#fff',
        boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
      });
      const header = document.createElement('div');
      Object.assign(header.style, {
        padding: '12px 16px',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontWeight: 'bold',
      });
      header.textContent = options.title || '';
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '\u00d7';
      Object.assign(closeBtn.style, {
        border: 'none',
        background: 'none',
        fontSize: '20px',
        cursor: 'pointer',
      });
      closeBtn.addEventListener('click', () => {
        panel.remove();
        if (options.onClose) options.onClose();
      });
      header.appendChild(closeBtn);
      const body = document.createElement('div');
      Object.assign(body.style, { flex: '1', overflow: 'auto', padding: '16px' });
      body.innerHTML = options.content || '';
      panel.appendChild(header);
      panel.appendChild(body);
      document.body.appendChild(panel);
      if (options.onOpen) options.onOpen();
      this.log('Panel added');
      return panel;
    },

    storage: {
      _request(action, key, value) {
        return new Promise((resolve) => {
          const id = `wsi_${Date.now()}_${Math.random()}`;
          window.addEventListener('message', function handler(e) {
            if (e.data && e.data.type === 'WSI_STORAGE_RESULT' && e.data.id === id) {
              window.removeEventListener('message', handler);
              resolve(e.data.result);
            }
          });
          window.postMessage(
            { type: 'WSI_STORAGE_REQUEST', id, pluginId, action, key, value },
            '*'
          );
        });
      },
      get(key) { return this._request('get', key); },
      set(key, value) { return this._request('set', key, value); },
      remove(key) { return this._request('remove', key); },
      getAll() { return this._request('getAll'); },
    },

    fetch(url, options) {
      return new Promise((resolve) => {
        const id = `wsi_fetch_${Date.now()}_${Math.random()}`;
        window.addEventListener('message', function handler(e) {
          if (e.data && e.data.type === 'WSI_FETCH_RESULT' && e.data.id === id) {
            window.removeEventListener('message', handler);
            resolve(e.data.result);
          }
        });
        window.postMessage(
          { type: 'WSI_FETCH_REQUEST', id, url, options: options || {} },
          '*'
        );
      });
    },

    getConfig() {
      return JSON.parse(JSON.stringify(this._config));
    },

    log(message) {
      console.log(`[WSI:${this._pluginId}] ${message}`);
    },

    onPageLoad(callback) {
      let lastUrl = location.href;
      const observer = new MutationObserver(() => {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          callback(lastUrl);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      window.addEventListener('popstate', () => {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          callback(lastUrl);
        }
      });
    },
  };

  try {
    const fn = new Function('WSI', code);
    fn(WSI);
  } catch (e) {
    console.error(`[WSI] Plugin runtime error (${pluginId}):`, e);
  }
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
  try {
    const res = await fetch(url, {
      method: options.method || 'HEAD',
      redirect: options.redirect || 'follow',
    });
    return {
      ok: res.ok,
      status: res.status,
      url: res.url,
      redirected: res.redirected,
    };
  } catch (err) {
    return { error: err.message, ok: false, status: 0 };
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
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2);
      return hostname === suffix || hostname.endsWith('.' + suffix);
    }
    return hostname === pattern;
  });
}
