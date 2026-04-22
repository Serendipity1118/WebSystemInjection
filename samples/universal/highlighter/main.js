// WSI サンプル: Highlighter
// 使用SDK: WSI.storage（get/set/remove/getAll 全部）/ WSI.addButton / WSI.getConfig
//          / WSI.onPageLoad / WSI.log
// 使用ブラウザAPI: window.getSelection / Range / TreeWalker
//
// ページ上で選択したテキストをハイライトし、WSI.storage にURL単位で保存する。
// 同じURLを再訪すると自動復元。Alt+クリックでハイライト削除。
// SPA対応（WSI.onPageLoad で URL変更を検知して再復元）。

const config = WSI.getConfig();
const color = config.color || '#fff59d';
const buttonPosition = config.buttonPosition || 'bottom-left';

// 操作フィードバック用Toast（1つだけ作って使い回す）
const toast = document.createElement('div');
toast.className = 'wsi-hl-toast';
document.body.appendChild(toast);

function showToast(message, isError) {
  toast.textContent = message;
  toast.classList.toggle('wsi-hl-toast--error', !!isError);
  toast.classList.add('wsi-hl-toast--show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove('wsi-hl-toast--show');
  }, 1500);
}

// URL別の一意キー（クエリとハッシュは無視）
function pageKey() {
  return `hl:${location.origin}${location.pathname}`;
}

// span 要素を作ってハイライトとして使う
function makeHighlightSpan(id) {
  const span = document.createElement('span');
  span.className = 'wsi-highlight';
  span.style.backgroundColor = color;
  span.dataset.wsiHighlightId = id;
  span.title = 'Alt+クリックで削除';
  return span;
}

// 選択範囲をハイライトして保存
async function highlightSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
    showToast('テキストを選択してください', true);
    return;
  }

  const range = selection.getRangeAt(0);
  const text = selection.toString();
  const id = `hl_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const span = makeHighlightSpan(id);

  try {
    // surroundContents は選択が単一要素内に収まっている場合に成功する
    range.surroundContents(span);
  } catch {
    showToast('この選択範囲はハイライトできません（要素境界をまたいでいます）', true);
    return;
  }

  selection.removeAllRanges();

  // WSI.storage にURL別で保存
  const key = pageKey();
  const highlights = (await WSI.storage.get(key)) || [];
  highlights.push({ id, text, createdAt: new Date().toISOString() });
  await WSI.storage.set(key, highlights);

  showToast(`ハイライト保存（${highlights.length}件）`);
  WSI.log(`Highlighted: "${text.slice(0, 30)}..."`);
}

// 保存済みテキストを検索してハイライトspanでラップ（復元用）
function findAndWrap(searchText, id) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      if (!n.parentElement) return NodeFilter.FILTER_REJECT;
      // 既存ハイライトや UI要素、script/styleを除外
      if (
        n.parentElement.closest(
          '.wsi-highlight, .wsi-hl-toast, .wsi-floating-button, .wsi-md-toast, .wsi-url-expander, script, style, noscript'
        )
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      return n.textContent.includes(searchText)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    }
  });

  const node = walker.nextNode();
  if (!node) return false;

  const idx = node.textContent.indexOf(searchText);
  const range = document.createRange();
  range.setStart(node, idx);
  range.setEnd(node, idx + searchText.length);

  const span = makeHighlightSpan(id);
  try {
    range.surroundContents(span);
    return true;
  } catch {
    return false;
  }
}

// storage から読み込んで DOM に復元
async function restoreHighlights() {
  const key = pageKey();
  const highlights = (await WSI.storage.get(key)) || [];
  let ok = 0;
  let fail = 0;
  for (const hl of highlights) {
    // 二重復元防止: 既にDOMに存在するか確認
    if (document.querySelector(`[data-wsi-highlight-id="${hl.id}"]`)) {
      ok++;
      continue;
    }
    if (findAndWrap(hl.text, hl.id)) ok++;
    else {
      fail++;
      WSI.log(`Restore failed: "${hl.text.slice(0, 30)}..."`);
    }
  }
  if (highlights.length > 0) {
    WSI.log(`Restored ${ok}/${highlights.length} highlights${fail > 0 ? ` (${fail} failed)` : ''}`);
  }
}

// Alt+クリックでハイライトを削除
document.addEventListener(
  'click',
  async (e) => {
    const span = e.target.closest('.wsi-highlight');
    if (!span) return;
    if (!e.altKey) return; // Alt未押下なら無視（通常のクリック/リンク動作を妨げない）
    e.preventDefault();
    e.stopPropagation();

    const id = span.dataset.wsiHighlightId;
    const key = pageKey();
    const highlights = (await WSI.storage.get(key)) || [];
    const updated = highlights.filter((h) => h.id !== id);

    // ページのハイライトが全て消えたら、キー自体を削除してstorageをクリーンに保つ
    if (updated.length === 0) {
      await WSI.storage.remove(key);
    } else {
      await WSI.storage.set(key, updated);
    }

    // span を展開: 子ノードを親に戻して span 自体を削除
    const parent = span.parentNode;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);

    showToast('ハイライト削除');
    WSI.log(`Removed highlight ${id}`);
  },
  true // capture phase でページ側のハンドラより先に実行
);

WSI.addButton({
  text: '🖍️',
  position: buttonPosition,
  onClick: highlightSelection,
});

// SPA対応: URL変更時に再復元
WSI.onPageLoad(() => {
  // DOM確定を少し待つ
  setTimeout(restoreHighlights, 500);
});

// 初回起動
(async () => {
  await restoreHighlights();

  // デモ: WSI.storage.getAll() でプラグイン全体のデータを俯瞰
  const allData = await WSI.storage.getAll();
  const totalHighlights = Object.entries(allData)
    .filter(([k]) => k.startsWith('hl:'))
    .reduce((sum, [, arr]) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  const pageCount = Object.keys(allData).filter((k) => k.startsWith('hl:')).length;
  WSI.log(`Storage overview: ${totalHighlights} highlights across ${pageCount} pages`);
})();

WSI.log('Highlighter loaded');
