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

1. **Service worker** — [src/background.js](src/background.js). Watches `tabs.onUpdated`, reads `plugins` + `wsiEnabled` from `chrome.storage.local`, filters by domain match, then calls `chrome.scripting.insertCSS` and `chrome.scripting.executeScript` with `world: 'MAIN'`. The injected function (`executePluginCode`) defines the `WSI` SDK **inside the page's main world** and wraps the plugin code in `new Function('WSI', code)` — this is why the SDK is not a separate file despite what older docs say.
2. **Content script** — [src/content-loader.js](src/content-loader.js). Does **not** inject plugin code. It only bridges `window.postMessage` ↔ `chrome.storage.local` / `chrome.runtime.sendMessage` so that main-world plugin code can reach extension APIs (storage, fetch).
3. **Popup UI** — [src/popup/](src/popup/). Handles ZIP import (via bundled [src/lib/jszip.min.js](src/lib/jszip.min.js)), plugin list, per-plugin enable/disable, and the global on/off toggle. All state is persisted in `chrome.storage.local`.

### Storage shape (`chrome.storage.local`)

- `wsiEnabled: boolean` — global kill switch. When `false`, `injectPlugins` bails out and the badge shows `OFF`.
- `plugins: Plugin[]` — installed plugins. Each entry inlines `code` (main.js text) and `css` (concatenated style text) so the service worker doesn't need filesystem access at runtime.
- `pluginData_<pluginId>: object` — per-plugin key/value store exposed to plugins as `WSI.storage`. Namespaced by plugin ID for isolation.

### Plugin bundle format

A plugin ZIP contains `plugin.json` + `main.js` (+ optional CSS listed in `styles[]`). Validation happens in [src/popup/popup.js](src/popup/popup.js) `validatePluginJson` — `id` must match `/^[a-zA-Z0-9-]+$/`, `domains[]` must be non-empty. `domains` supports `*.example.com` wildcard subdomain matching, and `"*"` alone as a match-all pattern (see `matchesDomain` in [src/background.js](src/background.js)).

### SDK surface (main-world only)

Exposed to plugin code via the `WSI` argument. Source of truth is `executePluginCode` in [src/background.js](src/background.js):

- `WSI.addButton({ text, icon, position, onClick })` — positions: `bottom-right` / `bottom-left` / `top-right` / `top-left`.
- `WSI.addPanel({ title, width, position: 'right'|'left', content, onOpen, onClose })`.
- `WSI.storage.get/set/remove/getAll` — async; round-trips through postMessage → content script → `chrome.storage.local`.
- `WSI.fetch(url, options)` — HEAD-by-default fetch proxied through the service worker to bypass page CSP/CORS. Options: `method`, `redirect`. Returns `{ ok, status, url, redirected }` or `{ error, ok:false, status:0 }`.
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

- Plugin code runs in the page's **main world**, not the content-script isolated world. It shares globals with the page but cannot call `chrome.*` APIs directly — go through the `WSI` SDK instead.
- The service worker silently swallows injection errors on `chrome://`, `edge://`, etc. URLs (the `try { new URL(...) }` block in `injectPlugins`). Don't add noisy logging for those.
- Toggling `wsiEnabled` or a plugin's `enabled` flag does **not** auto-reload open tabs — changes apply on next navigation. This matches the spec (F-01-3).
- There is no background build; editing files in [src/](src/) requires reloading the unpacked extension in `chrome://extensions` to pick up changes.
