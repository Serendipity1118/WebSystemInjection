(function () {
  const loc = window.location;
  if (!loc.hostname.includes('mgstage.com') || !loc.pathname.startsWith('/product/product_detail/')) return;

  function getContentId() {
    const paths = [];
    const canonical = document.querySelector('link[rel="canonical"]')?.href;
    if (canonical) {
      try { paths.push(new URL(canonical).pathname); } catch { /* fallback to the current URL */ }
    }
    paths.push(loc.pathname);

    for (const path of paths) {
      const match = path.match(/\/product\/product_detail\/([^/]+)/);
      if (match) return decodeURIComponent(match[1]).replace(/^SP-/i, '');
    }
    return null;
  }

  const contentId = getContentId();
  if (!contentId) return;
  const missavUrl = `https://missav.ai/ja/${contentId}`;
  let inserted = false;

  function normalizeLabel(text) {
    return text.replace(/[\s:：]/g, '');
  }

  function findHinbanTarget() {
    // PC layout: <tr><th>品番：</th><td>...</td></tr>
    const ths = document.querySelectorAll('th');
    for (const th of ths) {
      if (normalizeLabel(th.textContent) === '品番') {
        const row = th.closest('tr');
        if (row) return { layout: 'table', anchor: row };
      }
    }

    // Mobile layout: <dl><dt>品番</dt><dd>SP-...</dd></dl>
    const dts = document.querySelectorAll('dt');
    for (const dt of dts) {
      if (normalizeLabel(dt.textContent) === '品番') {
        const value = dt.nextElementSibling;
        return {
          layout: 'definition-list',
          anchor: value?.tagName === 'DD' ? value : dt,
        };
      }
    }
    return null;
  }

  function createMissavContent(exists) {
    if (exists) {
      const link = document.createElement('a');
      link.href = missavUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      link.className = 'wsi-missav-link';
      link.innerHTML = '<span class="wsi-missav-icon">▶</span> MISSAVへ';
      return link;
    }

    const span = document.createElement('span');
    span.className = 'wsi-missav-link wsi-missav-link--disabled';
    span.innerHTML = '<span class="wsi-missav-icon wsi-missav-icon--disabled">▶</span> MISSAVへ';
    span.title = 'このコンテンツはMISSAVに存在しません';
    return span;
  }

  function insertMissavField(target, exists) {
    if (inserted || document.getElementById('wsi-missav-row')) return;
    inserted = true;

    if (target.layout === 'definition-list') {
      const dt = document.createElement('dt');
      dt.textContent = 'MISSAV';

      const dd = document.createElement('dd');
      dd.id = 'wsi-missav-row';
      dd.appendChild(createMissavContent(exists));

      const parent = target.anchor.parentNode;
      parent.insertBefore(dt, target.anchor.nextSibling);
      parent.insertBefore(dd, dt.nextSibling);
      WSI.log(`MISSAV リンクを追加 (${exists ? '有効' : '無効'}): ${missavUrl}`);
      return;
    }

    // Keep the existing PC table layout unchanged.
    const targetRow = target.anchor;
    const newRow = document.createElement('tr');
    newRow.id = 'wsi-missav-row';

    const th = document.createElement('th');
    th.textContent = 'MISSAV：';

    const td = document.createElement('td');

    td.appendChild(createMissavContent(exists));

    newRow.appendChild(th);
    newRow.appendChild(td);
    targetRow.parentNode.insertBefore(newRow, targetRow.nextSibling);
    WSI.log(`MISSAV リンクを追加 (${exists ? '有効' : '無効'}): ${missavUrl}`);
  }

  async function checkMissavExists() {
    try {
      const res = await WSI.fetch(missavUrl, { method: 'HEAD' });
      if (!res || res.error) return true;
      if (res.redirected && res.url && res.url.includes('_gl=')) return false;
      return res.ok;
    } catch {
      return true;
    }
  }

  async function tryInsert() {
    const target = findHinbanTarget();
    if (!target) return false;

    const exists = await checkMissavExists();
    insertMissavField(target, exists);
    return true;
  }

  async function init() {
    const done = await tryInsert();
    if (done) return;

    const observer = new MutationObserver(async () => {
      if (inserted) { observer.disconnect(); return; }
      const done = await tryInsert();
      if (done) observer.disconnect();
    });
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => observer.disconnect(), 30000);
  }

  init();

  WSI.log('MGStage Enhancer プラグインが読み込まれました');
})();
