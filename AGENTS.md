# Repository Guidelines

## Project Structure & Module Organization

This repository contains a build-free Manifest V3 Chrome extension. Runtime code lives in `src/`: `background.js` injects matching plugins, `content-loader.js` bridges page messages to extension APIs, and `popup/` contains the management UI. Keep locale strings synchronized under `src/_locales/{ja,en,ko,zh_CN}/`. Reference plugin bundles live in `samples/<domain>/<plugin-id>/`; each bundle includes `plugin.json`, `main.js`, and optional styles. `tests/e2e/` contains Playwright fixtures, helpers, and `*.spec.js` suites. Product requirements are in `doc/`, while `html/` and `store-assets/` hold published documentation and store artwork.

## Build, Test, and Development Commands

- `npm ci` installs the exact dependency versions from `package-lock.json`.
- `npm run playwright:install` installs Chromium for the test suite (first setup only).
- `npm run test:e2e` runs all extension E2E tests in Chromium.
- `npm run test:e2e:headed` runs tests with a visible browser; `test:e2e:debug` and `test:e2e:ui` support investigation.
- `npx playwright test tests/e2e/popup.spec.js` runs one suite; add `-g "test title"` to target one case.

There is no compile or lint step. For manual testing, open `chrome://extensions`, enable Developer Mode, choose **Load unpacked**, and select `src/`. Reload the extension after source changes.

Create Chrome Web Store submission archives under the project-level `release/` directory, for example `release/WebSystemInjection-1.3.0.zip`.

## Coding Style & Naming Conventions

Use CommonJS, two-space indentation, semicolons, single-quoted JavaScript strings, and trailing commas in multiline objects. Prefer `camelCase` for functions and variables, `UPPER_SNAKE_CASE` for constants, and kebab-case for plugin IDs and directories. UI text must use `chrome.i18n.getMessage`; add every new key to all four locale catalogs. Plugin IDs must match `[a-zA-Z0-9-]+`.

## Testing Guidelines

Use Playwright's `test` and `expect` APIs. Name suites `*.spec.js`, reuse `fixtures.js` and `helpers.js`, and cover user-visible behavior plus storage, domain matching, and service-worker injection where relevant. No numeric coverage threshold is configured. Before submitting, run the full E2E suite; failure screenshots and reports are written to ignored Playwright output directories.

## Commit & Pull Request Guidelines

Recent commits use concise, outcome-focused subjects, usually in Japanese (for example, `outline-panelサンプルを追加`). Keep each commit scoped; Conventional Commit prefixes are optional. Pull requests should explain behavior and verification, link related issues, and include screenshots for popup or documentation UI changes. Call out manifest permission or storage-schema changes. When rebuilding a sample ZIP, increment its `plugin.json` version; when releasing the extension, also update `src/manifest.json`.
