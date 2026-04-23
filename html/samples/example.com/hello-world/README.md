# Hello World

WSI (Web System Injection) の入門サンプルプラグインです。指定したドメインを開くと画面右下に 👋 ボタンが表示され、クリックすると設定文字列を alert で表示します。

## 学べること

このサンプルでは、WSI SDK の最も基本的な 3 つの API の使い方を示します。

| API | 役割 |
|---|---|
| `WSI.getConfig()` | `plugin.json` の `config` に書いた値をプラグインコードから読み取る |
| `WSI.addButton(options)` | ページ上にフローティングボタンを追加する |
| `WSI.log(message)` | `[WSI:<plugin-id>]` プレフィックス付きでコンソールにログ出力する |

## ファイル構成

```
hello-world/
├── plugin.json   # プラグイン定義（ID、対象ドメイン、設定値）
├── main.js       # プラグイン本体（WSI SDK を使ったロジック）
├── style.css     # ボタンのホバー演出
└── hello-world.zip  # WSI にインポートする配布用 ZIP
```

## インストール手順

1. [WSI 拡張機能のインストール](../../../index.html#quick-start)を完了しておく
2. WSI アイコンをクリックしてポップアップを開く
3. 「プラグインを追加」→ [hello-world.zip](hello-world.zip) をドロップ → インポート
4. `example.com` を開くと右下に 👋 ボタンが表示されます

## カスタマイズしてみる

サンプルとして遊びやすい改造ポイント:

- `plugin.json` の `config.message` を書き換えると、alert で表示される文字列が変わります
- `plugin.json` の `domains` を自分の好きなドメイン（例: `"github.com"`）に変えると、そのサイトで動作します
- `main.js` の `position` を `top-left` / `top-right` / `bottom-left` に変えるとボタンの表示位置が変わります

書き換えたあとは、フォルダを再 ZIP 化して WSI にインポートし直してください（`plugin.json` の `version` も上げるのが推奨）。

## 次のステップ

- [プラグイン開発ガイドの SDK リファレンス](../../../index.html#sdk) で `addPanel` / `storage` / `fetch` / `onPageLoad` などの他の API も確認できます
