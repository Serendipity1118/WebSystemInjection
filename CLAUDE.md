# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WSI (Web System Injection) is a Chrome extension (Manifest V3) that injects per-domain custom features ("plugins") into existing websites. Developers author plugins as ZIP bundles and import them through the popup UI; the extension then runs them locally in the developer's own browser.

Full product spec is in [doc/要件定義.md](doc/要件定義.md). The extension source lives in [src/](src/) and is loaded unpacked from that directory — there is no build step.

## Commands

Install Playwright's Chromium once per machine:

```
npm run playwright:install
```

E2E tests (they launch a real Chromium with the extension loaded from [src/](src/)):

```
npm run test:e2e                     # headless-ish run (config forces headless: false)
npm run test:e2e:headed              # with visible browser
npm run test:e2e:debug               # Playwright inspector
npm run test:e2e:ui                  # Playwright UI mode
npx playwright test tests/e2e/popup.spec.js          # single file
npx playwright test -g "ZIPをインポート"             # single test by title
```

There is no lint or build command. Loading the extension manually: `chrome://extensions` → Developer Mode → "Load unpacked" → select [src/](src/).

## Architecture

Three runtime layers communicate via `chrome.runtime.sendMessage` and `window.postMessage`:

1. **Service worker** — [src/background.js](src/background.js). Watches `tabs.onUpdated`, reads `plugins` + `wsiEnabled` from `chrome.storage.local`, filters by domain match, then uses `chrome.userScripts.execute` to load [src/sdk/wsi-sdk.js](src/sdk/wsi-sdk.js) and invoke the imported plugin in the page's **MAIN world**. CSS is added by that user script, and a plugin that already ran in the current document is skipped (`reason: 'already-ran'`). Do not replace this with `eval`, `new Function`, or `chrome.scripting`; user-provided code must run through the User Scripts API for Manifest V3 policy compliance.
2. **Content script** — [src/content-loader.js](src/content-loader.js). Does **not** inject plugin code. It only bridges `window.postMessage` ↔ `chrome.storage.local` / `chrome.runtime.sendMessage` so that main-world plugin code can reach extension APIs (storage, fetch).
3. **Popup UI** — [src/popup/](src/popup/). Handles ZIP import (via bundled [src/lib/jszip.js](src/lib/jszip.js)), plugin list, per-plugin enable/disable, and the global on/off toggle. It warns when the browser's Allow User Scripts toggle is disabled. All state is persisted in `chrome.storage.local`.

### Storage shape (`chrome.storage.local`)

- `wsiEnabled: boolean` — global kill switch. When `false`, `injectPlugins` bails out and the badge shows `OFF`.
- `plugins: Plugin[]` — installed plugins. Each entry inlines `code` (main.js text) and `css` (concatenated style text) so the service worker doesn't need filesystem access at runtime.
- `pluginData_<pluginId>: object` — per-plugin key/value store exposed to plugins as `WSI.storage`. Namespaced by plugin ID for isolation.

### Plugin bundle format

A plugin ZIP contains `plugin.json` + `main.js` (+ optional CSS listed in `styles[]`). Validation happens in [src/popup/popup.js](src/popup/popup.js) `validatePluginJson` — `id` must match `/^[a-zA-Z0-9-]+$/`, `domains[]` must be non-empty. `domains` supports `*.example.com` wildcard subdomain matching, and `"*"` alone as a match-all pattern (see `matchesDomain` in [src/background.js](src/background.js)).

### SDK surface (main-world only)

Exposed to plugin code via the `WSI` argument. **The SDK is generated code.** Its source of truth is `packages/wsi_sdk` in the [WSIBrowser](https://github.com/Serendipity1118/WSIBrowser) repository (shared with the Flutter app WSI Browser). Update `packages/wsi_sdk/src/core` there, run `npm run build:sdk && npm run sync:wsi -w packages/wsi_sdk` (copies `dist/wsi-sdk-chrome.js` here), preserve the callable `__wsiRun(spec, pluginEntry)` interface without dynamic code evaluation, and bump `src/manifest.json`. The Chrome-specific part is `packages/wsi_sdk/src/adapters/chrome.js`, which keeps the `window.postMessage` protocol below so [src/content-loader.js](src/content-loader.js) is unchanged.

- `WSI.addButton({ text, icon, position, onClick })` — positions: `bottom-right` / `bottom-left` / `top-right` / `top-left`. Buttons are draggable by the user (Pointer Events, 44px minimum tap target, safe-area aware offsets); drag positions are persisted in `chrome.storage.local` under `wsiButtonPositions` (keyed as `<pluginId>_<buttonIndex>`). `position` acts as the default before any drag.
- `WSI.addPanel(...)` renders as a full-width bottom sheet when the viewport is narrower than 600px; otherwise a side panel as before. `panel.children[0]` is the header and `panel.children[1]` the body.
- `WSI.addPanel({ title, width, position: 'right'|'left', content, onOpen, onClose })`.
- `WSI.storage.get/set/remove/getAll` — async; round-trips through postMessage → content script → `chrome.storage.local`.
- `WSI.fetch(url, options)` — HEAD-by-default fetch proxied through the service worker to bypass page CSP/CORS. Options: `method`, `redirect`, `headers`, `body`, plus (v2) `credentials: 'site' | 'omit'` (default omit), `responseType: 'text' | 'json' | 'arraybuffer'` (arraybuffer arrives base64-encoded with `bodyEncoding: 'base64'`), `timeoutMs`. Returns `{ ok, status, url, redirected, headers, body }` (`headers` is a lowercase-keyed object of response headers; body is empty for HEAD) or `{ error, ok:false, status:0 }`.
- `WSI.permissions.has(name)` — v2. Plugins without a `permissions[]` in plugin.json (format v1) get `storage` + `fetch`. v2-only APIs (tabs, pages, menu, ...) do not exist in the extension; plugins should branch on `WSI.permissions.has(...)`.
- `WSI.getConfig()`, `WSI.log(msg)`, `WSI.onPageLoad(cb)` — `onPageLoad` hooks SPA navigation via MutationObserver + `popstate`.

## Conventions

### Versioning (from [.cursor/rules/plugin-versioning.mdc](.cursor/rules/plugin-versioning.mdc))

When re-creating a plugin ZIP, **always bump** `plugin.json`'s `version`:
- patch fix: `1.0.0` → `1.0.1`
- feature add: `1.0.x` → `1.1.0`
- breaking: `1.x.x` → `2.0.0`

Also bump the **extension's** `src/manifest.json` `version` whenever you re-bundle WSI itself.

### i18n

UI strings go through `chrome.i18n.getMessage` with message catalogs under [src/_locales/](src/_locales/) (`ja`, `en`, `ko`, `zh_CN`; default is `ja`). HTML uses `data-i18n`, `data-i18n-title`, `data-i18n-html` attributes — see `initI18n` in [src/popup/popup.js](src/popup/popup.js). When adding a new UI string, add it to **all four locales**.

### Sample plugins

[samples/](samples/) holds reference plugins. Note that [samples/dmm.co.jp/](samples/dmm.co.jp/) and [samples/mgstage.com/](samples/mgstage.com/) are **gitignored** — they are local-only examples; don't expect them in a fresh clone. [samples/example.com/hello-world/](samples/example.com/hello-world/) is the canonical committed sample.

## Things to watch out for

- Plugin code runs through `chrome.userScripts` in the page's **main world**, not the content-script isolated world. It shares globals with the page but cannot call `chrome.*` APIs directly — go through the `WSI` SDK instead.
- Users must enable Allow User Scripts in WSI's extension details (Developer mode on Chrome 137 and earlier). Tests persist this per-extension setting in a temporary Chromium profile.
- The service worker silently swallows injection errors on `chrome://`, `edge://`, etc. URLs (the `try { new URL(...) }` block in `injectPlugins`). Don't add noisy logging for those.
- Toggling `wsiEnabled` or a plugin's `enabled` flag does **not** auto-reload open tabs — changes apply on next navigation. This matches the spec (F-01-3).
- There is no background build; editing files in [src/](src/) requires reloading the unpacked extension in `chrome://extensions` to pick up changes.
