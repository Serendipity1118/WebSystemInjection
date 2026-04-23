// WSI サンプル: Jisho Popup
// 使用SDK: WSI.fetch（GET + body パース）/ WSI.addPanel / WSI.addButton / WSI.getConfig / WSI.log
// 使用ブラウザAPI: window.getSelection
//
// 日本語テキストを選択してボタンをクリックすると、Jisho.org の公開APIで
// 辞書検索を行い、結果をサイドパネルに表示する。
//
// Jisho.org API: https://jisho.org/api/v1/search/words?keyword=<word>
// このAPIは CORS ヘッダーを返さないため、ページJSから直接は叩けない。
// WSI.fetch が Service Worker 経由で実行するため CORS 制限を回避できる。

const config = WSI.getConfig();
const buttonPosition = config.buttonPosition || 'bottom-left';
const panelPosition = config.panelPosition || 'right';
const panelWidth = config.panelWidth || '380px';
const maxResults = config.maxResults || 10;
const maxSensesPerEntry = config.maxSensesPerEntry || 3;
const apiUrl = config.apiUrl || 'https://jisho.org/api/v1/search/words';

let currentPanel = null;

// エラー通知用Toast
const toast = document.createElement('div');
toast.className = 'wsi-jisho-toast';
document.body.appendChild(toast);

function showToast(message, isError) {
  toast.textContent = message;
  toast.classList.toggle('wsi-jisho-toast--error', !!isError);
  toast.classList.add('wsi-jisho-toast--show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove('wsi-jisho-toast--show');
  }, 1500);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

// WSI.fetch で Jisho API を叩いて JSON パース
async function lookup(word) {
  const res = await WSI.fetch(`${apiUrl}?keyword=${encodeURIComponent(word)}`, {
    method: 'GET',
  });
  if (res.error) throw new Error(res.error);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = JSON.parse(res.body);
  return data.data || [];
}

function renderEntry(entry) {
  const main = entry.japanese[0] || {};
  const kanji = main.word || main.reading || '';
  const reading = main.reading && main.word && main.reading !== main.word ? main.reading : '';

  const senses = (entry.senses || []).slice(0, maxSensesPerEntry).map((s, i) => {
    const pos = (s.parts_of_speech || []).join(', ');
    const defs = (s.english_definitions || []).join('; ');
    return `
      <div class="wsi-jisho-sense">
        <span class="wsi-jisho-num">${i + 1}.</span>
        ${pos ? `<span class="wsi-jisho-pos">${escapeHtml(pos)}</span>` : ''}
        <div class="wsi-jisho-def">${escapeHtml(defs)}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="wsi-jisho-entry">
      <div class="wsi-jisho-word">
        <span class="wsi-jisho-kanji">${escapeHtml(kanji)}</span>
        ${reading ? `<span class="wsi-jisho-reading">【${escapeHtml(reading)}】</span>` : ''}
      </div>
      ${senses}
    </div>
  `;
}

function renderResults(word, entries) {
  const header = `<div class="wsi-jisho-query">🔍 ${escapeHtml(word)}</div>`;
  if (entries.length === 0) {
    return header + '<div class="wsi-jisho-empty">辞書エントリが見つかりません</div>';
  }
  const list = entries.slice(0, maxResults).map(renderEntry).join('');
  const footer = entries.length > maxResults
    ? `<div class="wsi-jisho-footer">（${entries.length}件中 ${maxResults}件を表示）</div>`
    : '';
  return header + list + footer;
}

// panel body（header の次の要素）の innerHTML を更新
function updatePanelBody(panel, html) {
  const body = panel.children[1];
  if (body) body.innerHTML = html;
}

WSI.addButton({
  text: '辞',
  position: buttonPosition,
  onClick: async () => {
    const selection = window.getSelection();
    const word = selection ? selection.toString().trim() : '';

    if (!word) {
      showToast('日本語テキストを選択してください', true);
      return;
    }

    // 既存パネルがあれば閉じてから新規作成（loading表示用）
    if (currentPanel) currentPanel.remove();
    currentPanel = WSI.addPanel({
      title: 'Jisho 辞書',
      width: panelWidth,
      position: panelPosition,
      content: `<div class="wsi-jisho-query">🔍 ${escapeHtml(word)}</div><div class="wsi-jisho-loading">検索中...</div>`,
      onClose: () => { currentPanel = null; },
    });

    try {
      const entries = await lookup(word);
      if (currentPanel) updatePanelBody(currentPanel, renderResults(word, entries));
      WSI.log(`Looked up "${word}": ${entries.length} entries`);
    } catch (err) {
      if (currentPanel) {
        updatePanelBody(
          currentPanel,
          `<div class="wsi-jisho-query">🔍 ${escapeHtml(word)}</div><div class="wsi-jisho-error">エラー: ${escapeHtml(err.message)}</div>`
        );
      }
      WSI.log(`Lookup failed for "${word}": ${err.message}`);
    }
  },
});

WSI.log('Jisho Popup loaded');
