// WSI サンプル: Markdown Copy
// 使用SDK: WSI.addButton / WSI.getConfig / WSI.log
// 使用ブラウザAPI: window.getSelection / Range.cloneContents / navigator.clipboard
//
// ページで選択したテキストをMarkdown形式でクリップボードにコピーする。
// <a> は [text](url)、<h1-6>/<strong>/<em>/<code>/<ul>/<ol>/<blockquote>/<img> を変換。

const config = WSI.getConfig();
const includeCitation = config.includeCitation !== false;
const buttonPosition = config.buttonPosition || 'bottom-right';

// 操作フィードバック用のToast要素（1つだけ作って使い回す）
const toast = document.createElement('div');
toast.className = 'wsi-md-toast';
document.body.appendChild(toast);

function showToast(message, isError) {
  toast.textContent = message;
  toast.classList.toggle('wsi-md-toast--error', !!isError);
  toast.classList.add('wsi-md-toast--show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove('wsi-md-toast--show');
  }, 1500);
}

// DocumentFragment / Element / Text を再帰的に走査してMarkdownを生成
function nodeToMarkdown(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  // DocumentFragment は子要素を単に連結する（wrapperを持たない）
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
    return '';
  }

  const children = [...node.childNodes].map(nodeToMarkdown).join('');
  if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) return children;

  const tag = node.tagName.toLowerCase();
  switch (tag) {
    case 'a': {
      // getAttribute + new URL() で相対URLを絶対URLに変換
      const href = node.getAttribute('href') || '';
      let abs = href;
      try { abs = new URL(href, document.baseURI).href; } catch {}
      return children ? `[${children}](${abs})` : '';
    }
    case 'img': {
      const src = node.getAttribute('src') || '';
      let abs = src;
      try { abs = new URL(src, document.baseURI).href; } catch {}
      const alt = node.getAttribute('alt') || '';
      return `![${alt}](${abs})`;
    }
    case 'strong': case 'b': return children ? `**${children}**` : '';
    case 'em': case 'i': return children ? `*${children}*` : '';
    case 'code':
      // <pre><code>...</code></pre> の場合は素で返し、<pre>側でフェンスを付ける
      return node.parentElement?.tagName === 'PRE' ? children : `\`${children}\``;
    case 'pre': return `\n\`\`\`\n${children}\n\`\`\`\n`;
    case 'h1': return `\n# ${children}\n`;
    case 'h2': return `\n## ${children}\n`;
    case 'h3': return `\n### ${children}\n`;
    case 'h4': return `\n#### ${children}\n`;
    case 'h5': return `\n##### ${children}\n`;
    case 'h6': return `\n###### ${children}\n`;
    case 'p': return `\n\n${children}\n\n`;
    case 'br': return '\n';
    case 'hr': return '\n---\n';
    case 'blockquote':
      return '\n' + children.trim().split('\n').map((l) => `> ${l}`).join('\n') + '\n';
    case 'li': {
      const parent = node.parentElement;
      if (parent?.tagName === 'OL') {
        const idx = [...parent.children].indexOf(node) + 1;
        return `\n${idx}. ${children.trim()}`;
      }
      return `\n- ${children.trim()}`;
    }
    case 'ul': case 'ol': return children + '\n';
    default: return children;
  }
}

// 連続する改行を整理、前後トリム
function cleanupMarkdown(md) {
  return md.replace(/\n{3,}/g, '\n\n').trim();
}

WSI.addButton({
  text: '📋 MD',
  position: buttonPosition,
  onClick: async () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
      showToast('テキストを選択してください', true);
      return;
    }

    // Range.cloneContents() で選択範囲の構造を保ったDocumentFragmentが得られる
    const range = selection.getRangeAt(0);
    const fragment = range.cloneContents();

    let md = cleanupMarkdown(nodeToMarkdown(fragment));

    if (includeCitation) {
      md += `\n\n— [${document.title}](${location.href})`;
    }

    try {
      await navigator.clipboard.writeText(md);
      showToast('コピーしました ✓');
      WSI.log(`Copied ${md.length} chars as Markdown`);
    } catch (err) {
      showToast('コピー失敗: ' + err.message, true);
      WSI.log(`Copy failed: ${err.message}`);
    }
  }
});

WSI.log('Markdown Copy loaded');
