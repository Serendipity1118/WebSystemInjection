document.addEventListener('DOMContentLoaded', () => {
  const mainView = document.getElementById('main-view');
  const importView = document.getElementById('import-view');
  const addPluginBtn = document.getElementById('add-plugin-btn');
  const backBtn = document.getElementById('back-btn');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const previewSection = document.getElementById('preview-section');
  const previewContent = document.getElementById('preview-content');
  const importBtn = document.getElementById('import-btn');
  const errorSection = document.getElementById('error-section');
  const errorMessage = document.getElementById('error-message');
  const pluginList = document.getElementById('plugin-list');
  const pluginCount = document.getElementById('plugin-count');
  const emptyMessage = document.getElementById('empty-message');
  const globalToggle = document.getElementById('global-toggle');
  const globalStatusBar = document.getElementById('global-status-bar');
  const globalStatusIcon = document.getElementById('global-status-icon');
  const globalStatusText = document.getElementById('global-status-text');

  let pendingPlugin = null;

  function msg(key, substitutions) {
    return chrome.i18n.getMessage(key, substitutions) || key;
  }

  function initI18n() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const translated = msg(key);
      if (translated) el.textContent = translated;
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      const translated = msg(key);
      if (translated) el.setAttribute('title', translated);
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      const translated = msg(key);
      if (translated) el.innerHTML = translated.replace(/\n/g, '<br>');
    });
  }

  function updatePluginCountLabel(count) {
    const label = document.getElementById('header-plugin-count-label');
    if (label) {
      label.innerHTML = msg('pluginCountLabel', [String(count)])
        .replace(String(count), `<strong id="header-plugin-count">${count}</strong>`);
    }
  }

  initI18n();
  initGlobalToggle();
  loadPluginList();

  async function initGlobalToggle() {
    const { wsiEnabled = true } = await chrome.storage.local.get('wsiEnabled');
    globalToggle.checked = wsiEnabled;
    applyGlobalState(wsiEnabled);
  }

  function applyGlobalState(enabled) {
    globalStatusBar.classList.toggle('global-status-bar--enabled', enabled);
    globalStatusBar.classList.toggle('global-status-bar--disabled', !enabled);
    globalStatusIcon.textContent = enabled ? '●' : '○';
    globalStatusText.textContent = enabled ? msg('statusEnabled') : msg('statusDisabled');
    mainView.classList.toggle('main-view--disabled', !enabled);
  }

  globalToggle.addEventListener('change', async () => {
    const enabled = globalToggle.checked;
    await chrome.storage.local.set({ wsiEnabled: enabled });
    applyGlobalState(enabled);
  });

  addPluginBtn.addEventListener('click', () => {
    mainView.classList.add('hidden');
    importView.classList.remove('hidden');
    resetImportView();
  });

  backBtn.addEventListener('click', () => {
    importView.classList.add('hidden');
    mainView.classList.remove('hidden');
    resetImportView();
  });

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleZipFile(file);
  });
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleZipFile(file);
  });

  importBtn.addEventListener('click', () => importPlugin());

  async function handleZipFile(file) {
    resetImportView();
    try {
      const zip = await JSZip.loadAsync(file);
      const pluginJsonFile = zip.file('plugin.json');
      if (!pluginJsonFile) {
        showError(msg('errNoPluginJson'));
        return;
      }

      const pluginJsonText = await pluginJsonFile.async('string');
      let pluginDef;
      try {
        pluginDef = JSON.parse(pluginJsonText);
      } catch {
        showError(msg('errInvalidJson'));
        return;
      }

      const validationError = validatePluginJson(pluginDef);
      if (validationError) {
        showError(validationError);
        return;
      }

      const mainJsFile = zip.file(pluginDef.scripts.main);
      if (!mainJsFile) {
        showError(msg('errFileNotFound', [pluginDef.scripts.main]));
        return;
      }

      const code = await mainJsFile.async('string');

      let css = '';
      if (pluginDef.styles && pluginDef.styles.length > 0) {
        for (const stylePath of pluginDef.styles) {
          const cssFile = zip.file(stylePath);
          if (cssFile) {
            css += await cssFile.async('string');
          }
        }
      }

      pendingPlugin = {
        id: pluginDef.id,
        name: pluginDef.name,
        version: pluginDef.version,
        description: pluginDef.description || '',
        author: pluginDef.author || '',
        domains: pluginDef.domains,
        runAt: pluginDef.scripts.runAt || 'document_idle',
        enabled: true,
        code,
        css,
        config: pluginDef.config || {},
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      showPreview(pendingPlugin);
    } catch (err) {
      showError(msg('errZipFailed', [err.message]));
    }
  }

  function validatePluginJson(def) {
    if (!def.id || typeof def.id !== 'string') return msg('valIdRequired');
    if (!/^[a-zA-Z0-9-]+$/.test(def.id)) return msg('valIdFormat');
    if (!def.name || typeof def.name !== 'string') return msg('valNameRequired');
    if (!def.version || typeof def.version !== 'string') return msg('valVersionRequired');
    if (!def.domains || !Array.isArray(def.domains) || def.domains.length === 0)
      return msg('valDomainsRequired');
    if (!def.scripts || !def.scripts.main) return msg('valScriptsMainRequired');
    return null;
  }

  function showPreview(plugin) {
    previewContent.innerHTML = `
      <div><strong>${plugin.name}</strong> <span style="color:#888">v${plugin.version}</span></div>
      <div style="margin-top:4px;color:#666">${plugin.description}</div>
      <div style="margin-top:4px;color:#4688F1;font-size:12px">${plugin.domains.join(', ')}</div>
    `;
    previewSection.classList.remove('hidden');
  }

  function showError(text) {
    errorMessage.textContent = text;
    errorSection.classList.remove('hidden');
  }

  function resetImportView() {
    previewSection.classList.add('hidden');
    errorSection.classList.add('hidden');
    pendingPlugin = null;
    fileInput.value = '';
  }

  async function importPlugin() {
    if (!pendingPlugin) return;

    const { plugins = [] } = await chrome.storage.local.get('plugins');
    const existingIndex = plugins.findIndex((p) => p.id === pendingPlugin.id);

    if (existingIndex >= 0) {
      const overwrite = confirm(msg('confirmOverwrite', [pendingPlugin.name]));
      if (!overwrite) return;
      plugins[existingIndex] = {
        ...pendingPlugin,
        installedAt: plugins[existingIndex].installedAt,
        updatedAt: new Date().toISOString(),
      };
    } else {
      plugins.push(pendingPlugin);
    }

    await chrome.storage.local.set({ plugins });

    importView.classList.add('hidden');
    mainView.classList.remove('hidden');
    resetImportView();
    loadPluginList();
  }

  async function loadPluginList() {
    const { plugins = [] } = await chrome.storage.local.get('plugins');
    pluginCount.textContent = String(plugins.length);
    updatePluginCountLabel(plugins.length);

    if (plugins.length === 0) {
      emptyMessage.classList.remove('hidden');
      const cards = pluginList.querySelectorAll('.plugin-card');
      cards.forEach((c) => c.remove());
      return;
    }

    emptyMessage.classList.add('hidden');
    const existingCards = pluginList.querySelectorAll('.plugin-card');
    existingCards.forEach((c) => c.remove());

    for (const plugin of plugins) {
      const card = document.createElement('div');
      card.className = 'plugin-card';
      card.setAttribute('data-plugin-id', plugin.id);
      card.innerHTML = `
        <div class="plugin-card__header">
          <span class="plugin-card__name">${plugin.name}</span>
          <span class="plugin-card__version">v${plugin.version}</span>
        </div>
        <div class="plugin-card__desc">${plugin.description}</div>
        <div class="plugin-card__domains">${plugin.domains.join(', ')}</div>
        <div class="plugin-card__actions">
          <label class="toggle">
            <input type="checkbox" ${plugin.enabled ? 'checked' : ''}>
            <span class="toggle__slider"></span>
          </label>
          <button class="btn btn--danger delete-btn">${msg('deleteBtn')}</button>
        </div>
      `;

      const toggle = card.querySelector('input[type="checkbox"]');
      toggle.addEventListener('change', () => togglePlugin(plugin.id, toggle.checked));

      const deleteBtn = card.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', () => deletePlugin(plugin.id, plugin.name));

      pluginList.appendChild(card);
    }
  }

  async function togglePlugin(pluginId, enabled) {
    const { plugins = [] } = await chrome.storage.local.get('plugins');
    const plugin = plugins.find((p) => p.id === pluginId);
    if (plugin) {
      plugin.enabled = enabled;
      await chrome.storage.local.set({ plugins });
    }
  }

  async function deletePlugin(pluginId, pluginName) {
    if (!confirm(msg('confirmDelete', [pluginName]))) return;

    const { plugins = [] } = await chrome.storage.local.get('plugins');
    const filtered = plugins.filter((p) => p.id !== pluginId);
    await chrome.storage.local.set({ plugins: filtered });
    await chrome.storage.local.remove(`pluginData_${pluginId}`);
    loadPluginList();
  }
});
