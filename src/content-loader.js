(() => {
  'use strict';

  // Content Script: ストレージブリッジの設定
  // プラグインコードの注入はbackground.js (chrome.userScripts.execute) が担当
  // ここではメインワールド ↔ content script 間のストレージ通信を仲介する
  const isTopFrame = window.top === window;

  // iframe では plugin.json の frameDomains に一致したフレームだけブリッジを開き、
  // その後 background にプラグイン注入を依頼する（無関係な iframe に拡張 API を晒さない）
  if (isTopFrame) {
    window.addEventListener('message', onBridgeMessage);
  } else {
    chrome.runtime.sendMessage({ type: 'WSI_FRAME_CHECK' }).then((res) => {
      if (!res || !res.matched) return;
      window.addEventListener('message', onBridgeMessage);
      return chrome.runtime.sendMessage({ type: 'WSI_FRAME_INJECT' });
    }).catch(() => {
      // 拡張の再読み込み直後などは background と通信できないため無視
    });
  }

  // SDK は応答が来るまで同じ id の要求を 250ms ごとに再送する（ブリッジ準備待ちのため）。
  // 応答に時間のかかる fetch を再送のたびに実行すると、CDN に同じ要求が数十本並列で飛ぶので、
  // 処理中・処理済みの id は無視する（遅れて届く再送のため、完了後もしばらく保持する）
  const FETCH_ID_TTL_MS = 60000;
  const seenFetchIds = new Set();

  async function onBridgeMessage(e) {
    if (!e.data) return;

    if (e.data.type === 'WSI_FETCH_REQUEST') {
      const { id, url, options } = e.data;
      if (seenFetchIds.has(id)) return;
      seenFetchIds.add(id);
      setTimeout(() => seenFetchIds.delete(id), FETCH_ID_TTL_MS);
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

    if (e.data.type === 'WSI_BUTTON_POS_REQUEST') {
      const { id, action, pluginId, buttonIndex, position } = e.data;
      const storageKey = 'wsiButtonPositions';
      const mapKey = `${pluginId}_${buttonIndex}`;
      let result;
      try {
        const data = await chrome.storage.local.get(storageKey);
        const store = data[storageKey] || {};
        if (action === 'get') {
          result = store[mapKey] || null;
        } else if (action === 'set') {
          store[mapKey] = position;
          await chrome.storage.local.set({ [storageKey]: store });
          result = true;
        }
      } catch (err) {
        console.error('[WSI] Button position bridge error:', err);
        result = null;
      }
      window.postMessage({ type: 'WSI_BUTTON_POS_RESULT', id, result }, '*');
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
  }
})();
