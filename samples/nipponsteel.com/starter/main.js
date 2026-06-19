// WSI プラグイン: DijAW40 明細登録可能商談一覧 CSV 出力
// 使用SDK: WSI.getConfig / WSI.log / WSI.onPageLoad

(function () {
  'use strict';

  const config = WSI.getConfig();
  const TARGET_PATH = config.targetPath || '/esys969/dij_web/webapp/page/DijAW40';
  const CONTROL_ID = config.controlId || 'DijAW40100201KomokuListUserControl';
  const GRID_ID = config.gridId || 'DijAW40100201KomokuListUserControlGrid';
  const FILE_PREFIX = config.fileNamePrefix || '明細登録可能商談一覧';
  const BTN_MARKER = 'data-wsi-csv-btn';

  function isTargetPage() {
    return location.pathname === TARGET_PATH || location.pathname.endsWith('/DijAW40');
  }

  function formatTimestamp() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const sec = String(d.getSeconds()).padStart(2, '0');
    return `${y}${m}${day}_${h}${min}${sec}`;
  }

  function escapeCsv(value) {
    if (value == null) return '';
    const s = String(value);
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function getColumnHeader(grid, col) {
    try {
      return grid.columnHeaders.getCellData(0, col, true) || grid.columns[col].header || '';
    } catch {
      return grid.columns[col]?.header || '';
    }
  }

  function getShodanAttrs(grid, rowIndex, colIndex) {
    const item = grid.rows[rowIndex]?.dataItem;
    if (item) {
      const id =
        item.shodanId ?? item.shodanid ?? item.SHODAN_ID ?? item['商談番号'] ?? '';
      const kanriId =
        item.shodanKanriId ??
        item.shodankanriid ??
        item.SHODAN_KANRI_ID ??
        item['商談管理ID'] ??
        '';
      if (id || kanriId) {
        return { shodanId: String(id || ''), shodanKanriId: String(kanriId || '') };
      }
    }

    try {
      const cell = grid.cells.getCellElement(rowIndex, colIndex);
      const link = cell?.querySelector('.js-shodanId-link');
      if (link) {
        return {
          shodanId: link.getAttribute('data-shodanid') || link.textContent.trim(),
          shodanKanriId: link.getAttribute('data-shodankanriid') || '',
        };
      }
    } catch {
      // 仮想スクロールで非表示行は DOM 未取得のことがある
    }

    return { shodanId: '', shodanKanriId: '' };
  }

  function findShodanColumnIndex(grid) {
    for (let c = 0; c < grid.columns.length; c++) {
      const header = getColumnHeader(grid, c).replace(/\s+/g, '');
      if (header.includes('商談番号')) return c;
    }
    return 0;
  }

  function exportGridToCsv(grid) {
    const colCount = grid.columns.length;
    if (colCount === 0) {
      alert('出力する列がありません。');
      return;
    }

    const shodanCol = findShodanColumnIndex(grid);
    const headers = [];
    for (let c = 0; c < colCount; c++) {
      headers.push(getColumnHeader(grid, c));
    }
    headers.push('data-shodanid', 'data-shodankanriid');

    const lines = [headers.map(escapeCsv).join(',')];
    const rowCount = grid.rows.length;

    if (rowCount === 0) {
      alert('出力するデータがありません。');
      return;
    }

    for (let r = 0; r < rowCount; r++) {
      if (grid.rows[r].isHeaderRow) continue;

      const cells = [];
      for (let c = 0; c < colCount; c++) {
        cells.push(grid.getCellData(r, c, true));
      }

      const attrs = getShodanAttrs(grid, r, shodanCol);
      cells.push(attrs.shodanId, attrs.shodanKanriId);
      lines.push(cells.map(escapeCsv).join(','));
    }

    const bom = '\uFEFF';
    const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${FILE_PREFIX}_${formatTimestamp()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    WSI.log(`CSV出力完了: ${rowCount}行`);
  }

  function onExportClick() {
    const gridEl = document.getElementById(GRID_ID);
    if (!gridEl || typeof wijmo === 'undefined') {
      alert('一覧グリッドが見つかりません。ページの読み込み完了後に再度お試しください。');
      return;
    }

    const grid = wijmo.grid.FlexGrid.getControl(gridEl);
    if (!grid) {
      alert('Wijmo グリッドを取得できませんでした。');
      return;
    }

    exportGridToCsv(grid);
  }

  function injectButton(controlEl) {
    const header = controlEl.querySelector('.ControlHeader');
    if (!header || header.querySelector(`[${BTN_MARKER}]`)) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary btn-sm wsi-csv-export-btn';
    btn.textContent = '⬇ CSV出力';
    btn.setAttribute(BTN_MARKER, '1');
    btn.title = '一覧データをCSVファイルとしてダウンロード';
    btn.addEventListener('click', onExportClick);

    header.appendChild(btn);
    WSI.log('CSV出力ボタンを追加しました');
  }

  function tryInject() {
    if (!isTargetPage()) return;

    const controlEl = document.getElementById(CONTROL_ID);
    if (controlEl) {
      injectButton(controlEl);
    }
  }

  function startObserver() {
    if (!isTargetPage()) return;

    tryInject();

    const target = document.getElementById('Pane1') || document.getElementById('content') || document.body;
    const observer = new MutationObserver(() => tryInject());
    observer.observe(target, { childList: true, subtree: true });
  }

  WSI.onPageLoad(startObserver);
  startObserver();
})();
