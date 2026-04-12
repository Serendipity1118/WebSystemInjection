(() => {
  'use strict';

  // Content Script: ストレージブリッジの設定
  // プラグインコードの注入はbackground.js (chrome.scripting.executeScript) が担当
  // ここではメインワールド ↔ content script 間のストレージ通信を仲介する
  window.addEventListener('message', async (e) => {
    if (!e.data) return;

    if (e.data.type === 'WSI_FETCH_REQUEST') {
      const { id, url, options } = e.data;
      let result;
      try {
        result = await chrome.runtime.sendMessage({
          type: 'WSI_FETCH_REQUEST', id, url, options
        });
      } catch (err) {
        result = { error: err.message };
      }
      window.postMessage({ type: 'WSI_FETCH_RESULT', id, result }, '*');
      return;
    }

    if (e.data.type !== 'WSI_STORAGE_REQUEST') return;

    const { id, pluginId, action, key, value } = e.data;
    const storageKey = `pluginData_${pluginId}`;
    let result;

    try {
      const data = await chrome.storage.local.get(storageKey);
      const store = data[storageKey] || {};

      switch (action) {
        case 'get':
          result = store[key];
          break;
        case 'set':
          store[key] = value;
          await chrome.storage.local.set({ [storageKey]: store });
          result = true;
          break;
        case 'remove':
          delete store[key];
          await chrome.storage.local.set({ [storageKey]: store });
          result = true;
          break;
        case 'getAll':
          result = store;
          break;
      }
    } catch (err) {
      console.error('[WSI] Storage bridge error:', err);
      result = undefined;
    }

    window.postMessage({ type: 'WSI_STORAGE_RESULT', id, result }, '*');
  });
})();
