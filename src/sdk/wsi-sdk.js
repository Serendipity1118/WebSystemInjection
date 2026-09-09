/* WSI SDK 2.0.0 (chrome adapter). Generated from packages/wsi_sdk - do not edit by hand. */
(() => {
  // src/core/button.js
  var MIN_TAP = 44;
  var EDGE = 20;
  var DRAG_THRESHOLD = 4;
  var POSITIONS = {
    "bottom-right": { bottom: `calc(${EDGE}px + env(safe-area-inset-bottom, 0px))`, right: `calc(${EDGE}px + env(safe-area-inset-right, 0px))` },
    "bottom-left": { bottom: `calc(${EDGE}px + env(safe-area-inset-bottom, 0px))`, left: `calc(${EDGE}px + env(safe-area-inset-left, 0px))` },
    "top-right": { top: `calc(${EDGE}px + env(safe-area-inset-top, 0px))`, right: `calc(${EDGE}px + env(safe-area-inset-right, 0px))` },
    "top-left": { top: `calc(${EDGE}px + env(safe-area-inset-top, 0px))`, left: `calc(${EDGE}px + env(safe-area-inset-left, 0px))` }
  };
  function clampToViewport(btn, left, top) {
    const maxLeft = Math.max(0, window.innerWidth - btn.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - btn.offsetHeight);
    return {
      left: Math.round(Math.max(0, Math.min(maxLeft, left))),
      top: Math.round(Math.max(0, Math.min(maxTop, top)))
    };
  }
  function applyAbsolute(btn, left, top) {
    btn.style.left = `${left}px`;
    btn.style.top = `${top}px`;
    btn.style.right = "auto";
    btn.style.bottom = "auto";
  }
  function createButton(host, buttonIndex, options = {}) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = options.icon ? `${options.icon} ${options.text || ""}` : options.text || "";
    btn.className = "wsi-floating-button";
    btn.dataset.wsiButtonIndex = String(buttonIndex);
    const pos = options.position || "bottom-right";
    Object.assign(btn.style, {
      position: "fixed",
      zIndex: "2147483647",
      minWidth: `${MIN_TAP}px`,
      minHeight: `${MIN_TAP}px`,
      padding: "10px 16px",
      border: "none",
      borderRadius: "8px",
      background: "#4688F1",
      color: "#fff",
      fontSize: "14px",
      lineHeight: "1.2",
      cursor: "grab",
      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      userSelect: "none",
      webkitUserSelect: "none",
      touchAction: "none",
      webkitTapHighlightColor: "transparent",
      ...POSITIONS[pos] || POSITIONS["bottom-right"]
    });
    btn.title = (options.text || "") + "\uFF08\u30C9\u30E9\u30C3\u30B0\u3067\u79FB\u52D5\uFF09";
    (document.body || document.documentElement).appendChild(btn);
    host.adapter.buttonPos.get(buttonIndex).then((saved) => {
      if (!saved || typeof saved !== "object" || typeof saved.left !== "string" || typeof saved.top !== "string") return;
      const { left, top } = clampToViewport(
        btn,
        parseInt(saved.left, 10) || 0,
        parseInt(saved.top, 10) || 0
      );
      applyAbsolute(btn, left, top);
    }).catch(() => {
    });
    let dragging = false;
    let moved = false;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let offsetX = 0;
    let offsetY = 0;
    btn.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragging = true;
      moved = false;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      const rect = btn.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      btn.style.cursor = "grabbing";
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
      }
      e.preventDefault();
    });
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("pointermove", (e) => {
      if (!dragging || e.pointerId !== pointerId) return;
      if (!moved) {
        const dx = Math.abs(e.clientX - startX);
        const dy = Math.abs(e.clientY - startY);
        if (dx + dy > DRAG_THRESHOLD) moved = true;
      }
      if (moved) {
        const { left, top } = clampToViewport(btn, e.clientX - offsetX, e.clientY - offsetY);
        applyAbsolute(btn, left, top);
      }
    });
    const endDrag = (e) => {
      if (!dragging || e && e.pointerId !== pointerId) return;
      dragging = false;
      pointerId = null;
      btn.style.cursor = "grab";
      if (moved) {
        host.adapter.buttonPos.set(buttonIndex, { left: btn.style.left, top: btn.style.top }).catch(() => {
        });
      }
    };
    btn.addEventListener("pointerup", endDrag);
    btn.addEventListener("pointercancel", endDrag);
    btn.addEventListener("click", (e) => {
      if (moved) {
        e.preventDefault();
        e.stopImmediatePropagation();
        moved = false;
        return;
      }
      if (typeof options.onClick === "function") options.onClick(e);
    });
    host.log("Button added");
    return btn;
  }

  // src/core/panel.js
  var BOTTOM_SHEET_MAX_WIDTH = 600;
  function isNarrow() {
    return window.innerWidth < BOTTOM_SHEET_MAX_WIDTH;
  }
  function createPanel(host, options = {}) {
    const panel = document.createElement("div");
    panel.className = "wsi-panel";
    const position = options.position === "left" ? "left" : "right";
    const base = {
      position: "fixed",
      zIndex: "2147483646",
      background: "#fff",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
      color: "#222",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", sans-serif'
    };
    const applyLayout = () => {
      if (isNarrow()) {
        panel.dataset.wsiLayout = "sheet";
        Object.assign(panel.style, base, {
          top: "auto",
          left: "0",
          right: "0",
          bottom: "0",
          width: "100%",
          height: "auto",
          maxHeight: "70vh",
          borderRadius: "12px 12px 0 0",
          boxShadow: "0 -2px 12px rgba(0,0,0,0.2)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)"
        });
      } else {
        panel.dataset.wsiLayout = "side";
        Object.assign(panel.style, base, {
          top: "0",
          bottom: "auto",
          left: position === "left" ? "0" : "auto",
          right: position === "right" ? "0" : "auto",
          width: options.width || "300px",
          maxHeight: "none",
          height: "100vh",
          borderRadius: "0",
          boxShadow: position === "right" ? "-2px 0 8px rgba(0,0,0,0.15)" : "2px 0 8px rgba(0,0,0,0.15)",
          paddingBottom: "0"
        });
      }
    };
    applyLayout();
    const header = document.createElement("div");
    Object.assign(header.style, {
      padding: "12px 16px",
      borderBottom: "1px solid #e0e0e0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontWeight: "bold",
      flexShrink: "0"
    });
    header.textContent = options.title || "";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "\xD7";
    closeBtn.setAttribute("aria-label", "close");
    Object.assign(closeBtn.style, {
      border: "none",
      background: "none",
      fontSize: "20px",
      minWidth: "44px",
      minHeight: "44px",
      cursor: "pointer",
      color: "inherit"
    });
    const onResize = () => applyLayout();
    window.addEventListener("resize", onResize);
    const close = () => {
      window.removeEventListener("resize", onResize);
      panel.remove();
      if (typeof options.onClose === "function") options.onClose();
    };
    closeBtn.addEventListener("click", close);
    header.appendChild(closeBtn);
    const body = document.createElement("div");
    Object.assign(body.style, {
      flex: "1",
      overflow: "auto",
      padding: "16px",
      WebkitOverflowScrolling: "touch"
    });
    body.innerHTML = options.content || "";
    panel.appendChild(header);
    panel.appendChild(body);
    (document.body || document.documentElement).appendChild(panel);
    if (typeof options.onOpen === "function") options.onOpen();
    host.log("Panel added");
    return panel;
  }

  // src/core/page_load.js
  var URL_CHANGE_EVENT = "wsi:urlchange";
  function onPageLoad(callback) {
    if (typeof callback !== "function") return () => {
    };
    let lastUrl = location.href;
    const notify = () => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      try {
        callback(lastUrl);
      } catch (e) {
        console.error("[WSI] onPageLoad callback error:", e);
      }
    };
    window.addEventListener(URL_CHANGE_EVENT, notify);
    window.addEventListener("popstate", notify);
    let observer = null;
    const target = document.body || document.documentElement;
    if (target && typeof MutationObserver === "function") {
      observer = new MutationObserver(notify);
      observer.observe(target, { childList: true, subtree: true });
    }
    return () => {
      window.removeEventListener(URL_CHANGE_EVENT, notify);
      window.removeEventListener("popstate", notify);
      if (observer) observer.disconnect();
    };
  }

  // src/core/v2.js
  function installV2(WSI, adapter, events) {
    const call = (op, payload) => adapter.call(op, payload);
    const unwrap = async (op, payload) => {
      const r = await call(op, payload);
      if (r && typeof r === "object" && "error" in r && Object.keys(r).length <= 2) {
        throw new Error(String(r.error));
      }
      return r;
    };
    WSI.toast = (message, options) => {
      call("toast", { message: String(message), ...options || {} });
    };
    WSI.dialog = (options) => unwrap("dialog", options || {});
    WSI.ui = {
      openPage: (name, params) => unwrap("ui.openPage", { name, params: params || {} }),
      closePage: () => {
        call("ui.closePage", {});
      }
    };
    WSI.settings = {
      get: (key) => unwrap("settings.get", { key }),
      set: (key, value) => unwrap("settings.set", { key, value }),
      getAll: () => unwrap("settings.getAll", {}),
      onChange: (cb) => events.on("settings.change", cb)
    };
    WSI.policy = {
      get: (key) => unwrap("policy.get", { key }),
      getAll: () => unwrap("policy.getAll", {}),
      refresh: () => unwrap("policy.refresh", {})
    };
    WSI.menu = {
      register: (items) => {
        const list = Array.isArray(items) ? items : [];
        for (const item of list) {
          if (item && item.id) {
            if (typeof item.onSelect === "function") events.on(`menu.select:${item.id}`, item.onSelect);
            if (typeof item.onChange === "function") events.on(`menu.change:${item.id}`, item.onChange);
          }
        }
        return unwrap("menu.register", {
          items: list.map((i) => ({ id: i.id, label: i.label, icon: i.icon, type: i.type, page: i.page, checked: i.checked }))
        });
      },
      update: (id, patch) => unwrap("menu.update", { id, ...patch || {} })
    };
    WSI.runtime = {
      sendMessage: (message) => unwrap("runtime.sendMessage", { message }),
      onMessage: (cb) => events.on("runtime.message", cb, { reply: true }),
      onSuspend: (cb) => events.on("runtime.suspend", cb),
      onResume: (cb) => events.on("runtime.resume", cb)
    };
    WSI.tabs = {
      open: (url, options) => unwrap("tabs.open", { url, ...options || {} }),
      navigate: (tabId, url) => unwrap("tabs.navigate", { tabId, url }),
      run: (tabId, code) => unwrap("tabs.run", { tabId, code: String(code) }),
      close: (tabId) => unwrap("tabs.close", { tabId }),
      list: () => unwrap("tabs.list", {}),
      onLoad: (cb) => events.on("tabs.load", (p) => cb(p.tabId, p.url, p.error)),
      onClose: (cb) => events.on("tabs.close", (p) => cb(p.tabId)),
      /**
       * Dialogs of tabs this worker opened. Android runs every WebView in one
       * renderer, so a blocking alert() in a tab also freezes this worker: the
       * host cannot wait for [cb] there and answers with `options.default`
       * ('accept' | 'dismiss' | 'show', default 'accept') right away, then
       * delivers the event to [cb] afterwards. iOS asks [cb] first.
       */
      onDialog: (cb, options) => {
        call("tabs.dialogPolicy", { action: options && options.default || "accept" });
        return events.on("tabs.dialog", cb, { reply: true });
      }
    };
    WSI.credentials = {
      set: (profile, value) => unwrap("credentials.set", { profile, value }),
      get: (profile) => unwrap("credentials.get", { profile }),
      remove: (profile) => unwrap("credentials.remove", { profile })
    };
    WSI.device = { id: () => unwrap("device.id", {}) };
    WSI.share = (options) => unwrap("share", options || {});
    WSI.files = {
      save: (name, data, options) => unwrap("files.save", { name, data, ...options || {} }),
      pick: (options) => unwrap("files.pick", options || {})
    };
    WSI.clipboard = { write: (text) => unwrap("clipboard.write", { text: String(text) }) };
    WSI.wakeLock = { acquire: () => unwrap("wakeLock.acquire", {}), release: () => unwrap("wakeLock.release", {}) };
    WSI.pip = { enter: () => unwrap("pip.enter", {}), isSupported: () => unwrap("pip.isSupported", {}) };
    WSI.blockResources = (options) => unwrap("blockResources", options || {});
    WSI.navigation = {
      intercept: (cb) => events.on("navigation.intercept", cb, { reply: true })
    };
  }
  function createEventBus() {
    const listeners = /* @__PURE__ */ new Map();
    return {
      on(event, cb, options) {
        if (typeof cb !== "function") return () => {
        };
        const list = listeners.get(event) || [];
        const entry = { cb, reply: !!(options && options.reply) };
        list.push(entry);
        listeners.set(event, list);
        return () => {
          const l = listeners.get(event) || [];
          const i = l.indexOf(entry);
          if (i >= 0) l.splice(i, 1);
        };
      },
      async emit(event, payload, sender) {
        const list = listeners.get(event) || [];
        let reply;
        for (const entry of list) {
          try {
            const r = await entry.cb(payload, sender);
            if (entry.reply && reply === void 0 && r !== void 0) reply = r;
          } catch (e) {
            console.error(`[WSI] listener error (${event}):`, e);
          }
        }
        return reply;
      },
      count(event) {
        return (listeners.get(event) || []).length;
      }
    };
  }

  // src/core/index.js
  var SDK_VERSION = "2.0.0";
  var V1_PERMISSIONS = Object.freeze(["storage", "fetch"]);
  var IMPLICIT_PERMISSIONS = /* @__PURE__ */ new Set(["storage"]);
  function normalizePermissions(list) {
    const set = new Set(IMPLICIT_PERMISSIONS);
    for (const p of Array.isArray(list) ? list : V1_PERMISSIONS) {
      if (typeof p === "string") set.add(p);
    }
    return set;
  }
  function deepCopy(value) {
    return value === void 0 ? void 0 : JSON.parse(JSON.stringify(value));
  }
  function createWSI(spec, adapter, events = createEventBus()) {
    const pluginId = spec.pluginId;
    const config = spec.config || {};
    const context = spec.context || "page";
    const permissions = normalizePermissions(spec.permissions);
    const inPage = context === "page";
    let buttonCount = 0;
    const log = (message) => {
      const text = String(message);
      console.log(`[WSI:${pluginId}] ${text}`);
      if (typeof adapter.log === "function") {
        try {
          adapter.log("log", text);
        } catch {
        }
      }
    };
    const host = { adapter, log };
    const notAvailable = (name) => () => {
      throw new Error(`WSI.${name} is not available in the '${context}' context`);
    };
    const WSI = {
      _pluginId: pluginId,
      _config: config,
      _context: context,
      _version: SDK_VERSION,
      addButton: inPage ? (options) => createButton(host, buttonCount++, options) : notAvailable("addButton"),
      addPanel: inPage ? (options) => createPanel(host, options) : notAvailable("addPanel"),
      onPageLoad: inPage ? onPageLoad : notAvailable("onPageLoad"),
      storage: {
        get: (key) => adapter.storage.get(key),
        set: (key, value) => adapter.storage.set(key, value),
        remove: (key) => adapter.storage.remove(key),
        getAll: () => adapter.storage.getAll()
      },
      fetch: (url, options) => adapter.fetch(String(url), options || {}),
      getConfig: () => deepCopy(config),
      log,
      permissions: {
        has: (name) => permissions.has(name),
        list: () => Array.from(permissions)
      }
    };
    if (adapter.v2 === true) {
      installV2(WSI, adapter, events);
    }
    return WSI;
  }
  function runPlugin(spec, adapter, events) {
    const WSI = createWSI(spec, adapter, events);
    try {
      const fn = new Function("WSI", spec.code);
      fn(WSI);
      if (typeof adapter.onRun === "function") adapter.onRun();
      return { ok: true };
    } catch (e) {
      console.error(`[WSI] Plugin runtime error (${spec.pluginId}):`, e);
      if (typeof adapter.log === "function") {
        try {
          adapter.log("error", `Plugin runtime error: ${e && e.message ? e.message : e}`);
        } catch {
        }
      }
      return { ok: false, reason: e && e.message ? e.message : String(e) };
    }
  }
  var RAN_KEY = "__wsiRanPlugins";
  function installRunner(adapterFactory) {
    const g = globalThis;
    if (typeof g.__wsiRun === "function") return g.__wsiRun;
    const ran = /* @__PURE__ */ new Set();
    Object.defineProperty(g, RAN_KEY, { value: ran, enumerable: false, configurable: true });
    const buses = /* @__PURE__ */ new Map();
    const run = (spec) => {
      if (!spec || typeof spec.pluginId !== "string" || typeof spec.code !== "string") {
        return { ok: false, reason: "invalid spec" };
      }
      if (!spec.force && ran.has(spec.pluginId)) {
        return { ok: false, reason: "already-ran" };
      }
      const adapter = adapterFactory({
        pluginId: spec.pluginId,
        token: spec.token,
        context: spec.context || "page"
      });
      ran.add(spec.pluginId);
      const events = createEventBus();
      if (spec.token) buses.set(spec.token, events);
      const result = runPlugin(spec, adapter, events);
      if (!result.ok) {
        ran.delete(spec.pluginId);
        if (spec.token) buses.delete(spec.token);
      }
      return result;
    };
    const emit = (token, event, payload, sender) => {
      const bus = buses.get(token);
      if (!bus) return Promise.resolve(void 0);
      return bus.emit(event, payload, sender);
    };
    Object.defineProperty(g, "__wsiRun", { value: run, enumerable: false, configurable: true });
    Object.defineProperty(g, "__wsiEmit", { value: emit, enumerable: false, configurable: true });
    Object.defineProperty(g, "__wsiSdkVersion", { value: SDK_VERSION, enumerable: false, configurable: true });
    return run;
  }

  // src/adapters/chrome.js
  var RETRY_INTERVAL_MS = 250;
  var MAX_ATTEMPTS = 40;
  function request(type, resultType, fields) {
    return new Promise((resolve) => {
      const id = `wsi_${Date.now()}_${Math.random()}`;
      const message = { type, id, ...fields };
      let attempts = 0;
      let timer = null;
      const handler = (e) => {
        if (e.source !== window) return;
        if (e.data && e.data.type === resultType && e.data.id === id) {
          window.removeEventListener("message", handler);
          clearTimeout(timer);
          resolve(e.data.result);
        }
      };
      window.addEventListener("message", handler);
      const post = () => {
        attempts += 1;
        window.postMessage(message, "*");
        if (attempts < MAX_ATTEMPTS) {
          timer = setTimeout(post, RETRY_INTERVAL_MS);
        } else {
          window.removeEventListener("message", handler);
          resolve(type === "WSI_FETCH_REQUEST" ? { error: "WSI bridge unavailable", ok: false, status: 0 } : void 0);
        }
      };
      post();
    });
  }
  function createChromeAdapter({ pluginId }) {
    const storageRequest = (action, key, value) => request("WSI_STORAGE_REQUEST", "WSI_STORAGE_RESULT", { pluginId, action, key, value });
    return {
      storage: {
        get: (key) => storageRequest("get", key),
        set: (key, value) => storageRequest("set", key, value),
        remove: (key) => storageRequest("remove", key),
        getAll: () => storageRequest("getAll")
      },
      fetch: (url, options) => request("WSI_FETCH_REQUEST", "WSI_FETCH_RESULT", { url, options: options || {} }),
      buttonPos: {
        get: (buttonIndex) => request("WSI_BUTTON_POS_REQUEST", "WSI_BUTTON_POS_RESULT", {
          action: "get",
          pluginId,
          buttonIndex
        }),
        set: (buttonIndex, position) => request("WSI_BUTTON_POS_REQUEST", "WSI_BUTTON_POS_RESULT", {
          action: "set",
          pluginId,
          buttonIndex,
          position
        })
      },
      // v2 operations are not available in the Chrome extension.
      call: (op) => Promise.resolve({ error: `unsupported op in chrome: ${op}` })
    };
  }

  // src/entry/chrome.js
  installRunner(createChromeAdapter);
})();
