// WSI サンプル: Outline Panel
// 使用SDK: WSI.addPanel（主役）/ WSI.addButton / WSI.getConfig / WSI.onPageLoad / WSI.log
// 使用ブラウザAPI: querySelectorAll / Element.scrollIntoView / requestAnimationFrame
//
// ページ内の h1〜h6 見出しを収集してサイドパネルにTOC（目次）を表示する。
// クリックで該当見出しにスムーズスクロール、現在読んでいる位置を自動ハイライト。
// SPA 対応（WSI.onPageLoad で再ビルド）。

const config = WSI.getConfig();
const buttonPosition = config.buttonPosition || 'top-left';
const panelPosition = config.panelPosition || 'right';
const panelWidth = config.panelWidth || '320px';

let currentPanel = null;
let currentHeadings = [];
let scrollRafId = null;

// 表示されている見出しのみ収集（非表示要素はスキップ）
function scanHeadings() {
  return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    .filter((h) => {
      const text = h.textContent.trim();
      if (!text) return false;
      const rect = h.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    })
    .map((h, i) => {
      // スクロール先として使うため、id が無い見出しには自動生成の id を付与
      if (!h.id) h.id = `wsi-outline-auto-${i}`;
      return {
        id: h.id,
        level: parseInt(h.tagName[1], 10),
        text: h.textContent.trim(),
        element: h,
      };
    });
}

// innerHTML に渡すので必ずエスケープ（見出しに &, <, > 等が含まれる可能性）
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function buildPanelContent(headings) {
  if (headings.length === 0) {
    return '<div class="wsi-outline-empty">見出しが見つかりません</div>';
  }
  const items = headings
    .map((h, i) => {
      const indent = (h.level - 1) * 16;
      return `<li class="wsi-outline-item wsi-outline-l${h.level}" style="padding-left: ${indent}px"><a href="#${h.id}" data-heading-idx="${i}">${escapeHtml(h.text)}</a></li>`;
    })
    .join('');
  return `<ul class="wsi-outline-list">${items}</ul>`;
}

// 現在読んでいる位置の見出しをpanel側にハイライト表示
function updateActive() {
  if (scrollRafId) return;
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null;
    if (!currentPanel || currentHeadings.length === 0) return;
    const triggerY = window.innerHeight * 0.3;
    let activeIdx = -1;
    for (let i = 0; i < currentHeadings.length; i++) {
      if (currentHeadings[i].element.getBoundingClientRect().top <= triggerY) {
        activeIdx = i;
      } else {
        break;
      }
    }
    currentPanel.querySelectorAll('a[data-heading-idx]').forEach((a) => {
      a.classList.toggle(
        'wsi-outline-active',
        parseInt(a.dataset.headingIdx, 10) === activeIdx
      );
    });
  });
}

function openPanel() {
  // 既にパネルが開いていれば再ビルド（ボタンが閉じる/開くのトグルではなく更新動作）
  if (currentPanel) currentPanel.remove();

  currentHeadings = scanHeadings();

  // WSI.addPanel は <div> をページに appendChild して返す
  const panel = WSI.addPanel({
    title: `目次 (${currentHeadings.length}件)`,
    width: panelWidth,
    position: panelPosition,
    content: buildPanelContent(currentHeadings),
    onClose: () => {
      currentPanel = null;
      currentHeadings = [];
    },
  });
  currentPanel = panel;

  // 各 <a> クリックで該当見出しへスムーズスクロール
  panel.querySelectorAll('a[data-heading-idx]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = parseInt(a.dataset.headingIdx, 10);
      const target = currentHeadings[idx]?.element;
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  updateActive();
  WSI.log(`Panel opened (${currentHeadings.length} headings)`);
}

WSI.addButton({
  text: '📑',
  position: buttonPosition,
  onClick: openPanel,
});

// スクロール追従は rAF でスロットリング、passive で競合しない
window.addEventListener('scroll', updateActive, { passive: true });

// SPA: URL変更後、パネルが開いたままなら 500ms 後に再ビルド（DOM確定を待つ）
WSI.onPageLoad(() => {
  if (currentPanel) {
    setTimeout(openPanel, 500);
  }
});

WSI.log('Outline Panel loaded');
