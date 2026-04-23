// WSI サンプル: URL Expander
// 使用SDK: WSI.fetch（HEAD + redirect follow）/ WSI.getConfig / WSI.log
//
// 短縮URLリンクにホバーすると、リダイレクト先の最終URLをツールチップで表示する。
// フィッシング対策や、クリックする前に行き先を確認するためのプレビュー用途。

const config = WSI.getConfig();
const shorteners = config.shorteners || [];
const hoverDelay = config.hoverDelayMs || 400;

// 同じURLを何度もfetchしないためのメモリキャッシュ（Promiseを保存するので同時ホバーもOK）
const cache = new Map();
let hoverTimer = null;
let activeHref = null;

// ツールチップ要素は1つだけ作って使い回す
const tooltip = document.createElement('div');
tooltip.className = 'wsi-url-expander';
tooltip.setAttribute('role', 'tooltip');
document.body.appendChild(tooltip);

function isShortener(url) {
  try {
    const h = new URL(url).hostname;
    return shorteners.some((s) => h === s || h.endsWith('.' + s));
  } catch {
    return false;
  }
}

function showTooltip(text, anchor) {
  // textContent を使うことで、悪意あるURL文字列によるXSSを防ぐ
  tooltip.textContent = text;
  tooltip.style.display = 'block';
  const r = anchor.getBoundingClientRect();
  const x = Math.min(r.left, window.innerWidth - 420);
  tooltip.style.left = Math.max(8, x) + 'px';
  tooltip.style.top = r.bottom + 6 + 'px';
}

function hideTooltip() {
  tooltip.style.display = 'none';
}

function resolve(url) {
  if (cache.has(url)) return cache.get(url);

  // WSI.fetch は background.js の service worker 側で fetch() を実行するため、
  // ページのCORS制限を受けない。ここが WSI の特徴的な機能。
  const promise = (async () => {
    const res = await WSI.fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (!res || res.error) return `エラー: ${(res && res.error) || '不明'}`;
    if (!res.ok) return `取得失敗 (HTTP ${res.status})`;
    if (res.redirected) return `→ ${res.url}`;
    return '(リダイレクトなし)';
  })();

  cache.set(url, promise);
  return promise;
}

document.addEventListener('mouseover', (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  const href = a.href;
  if (!isShortener(href)) return;

  clearTimeout(hoverTimer);
  activeHref = href;

  hoverTimer = setTimeout(async () => {
    showTooltip('🔍 解決中...', a);
    const result = await resolve(href);
    // ユーザーが既に別の場所へマウスを動かしていたら表示しない
    if (activeHref === href) showTooltip(result, a);
  }, hoverDelay);
});

document.addEventListener('mouseout', (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  clearTimeout(hoverTimer);
  activeHref = null;
  hideTooltip();
});

WSI.log(`URL Expander loaded (${shorteners.length} shortener domains)`);
