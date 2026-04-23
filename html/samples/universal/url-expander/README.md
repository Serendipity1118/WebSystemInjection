# URL Expander

短縮URL（`bit.ly` / `t.co` / `tinyurl.com` など）のリンクにマウスホバーすると、**リダイレクト先の最終URL**をツールチップで表示するWSIプラグインです。クリックする前に行き先を確認できるので、フィッシング対策やノイズ回避に使えます。

## 学べること

このサンプルは **WSI の独自価値である `WSI.fetch`** の実用例を示します。普通のWebページのJavaScriptでは、別ドメインへの `fetch` は CORS で遮断されますが、WSI では Service Worker 経由で実行されるためこの制限を受けません。

| API | 役割 |
|---|---|
| `WSI.fetch(url, { method, redirect })` | CORS制限なしで任意のURLへリクエスト。戻り値の `res.url` / `res.redirected` でリダイレクト先が分かる |
| `WSI.getConfig()` | `plugin.json` の `config` から対応する短縮サービス一覧を取得 |
| `WSI.log(message)` | 起動時のログ出力 |

加えて、**`domains: ["*"]`**（全サイトマッチ）の書き方も見られます。これは WSI v1.2.0 から追加された記法です。

## ファイル構成

```
url-expander/
├── plugin.json       # 対応する短縮サービス一覧を config で管理
├── main.js           # ホバー検知 → WSI.fetch → ツールチップ表示
├── style.css         # ツールチップのスタイル
├── README.md
└── url-expander.zip  # WSI にインポートする配布用 ZIP
```

## インストール手順

1. [WSI 拡張機能のインストール](../../../index.html#quick-start)を完了しておく
2. WSI アイコンをクリックしてポップアップを開く
3. 「プラグインを追加」→ [url-expander.zip](url-expander.zip) をドロップ → インポート
4. 任意のサイトを開き、`bit.ly/...` などの短縮URLリンクにマウスをホバーすると、400ms後に最終URLが表示されます

### 動作確認用リンク

試すには、例えば:

- [Wikipedia の短縮URLを使った記事](https://ja.wikipedia.org/wiki/URL%E7%9F%AD%E7%B8%AE%E3%82%B5%E3%83%BC%E3%83%93%E3%82%B9)
- X（旧Twitter）のタイムライン — 投稿内のリンクはほぼ全て `t.co` 経由

## カスタマイズしてみる

### 対応する短縮サービスを追加する

`plugin.json` の `config.shorteners` 配列に追記してください。サブドメインも自動でマッチします（`"example.com"` と書けば `www.example.com` も対象）。

```json
"config": {
  "shorteners": [
    "bit.ly",
    "t.co",
    "my-company-short.example"   // ← 追加
  ]
}
```

### ホバー後の表示遅延を変える

`config.hoverDelayMs` の値を変更します。デフォルト 400ms。小さくすると反応が早くなるかわりに、リンク上を通過しただけでも fetch が走ります。

### 挙動を全URLに拡張する（上級）

ショートナーだけでなく全リンクで最終URLを表示したい場合は、`main.js` の `isShortener(href)` チェックを外すと動きますが、ページによって大量のリクエストが飛ぶのでおすすめはしません。

## 内部の仕組み（簡易）

```
[ユーザがリンクにホバー]
   ↓ mouseover イベント
[main.js] が href を抽出、ショートナーか判定
   ↓ WSI.fetch(url, { method: 'HEAD', redirect: 'follow' })
[content-loader.js] が postMessage 経由で受け取り
   ↓ chrome.runtime.sendMessage
[background.js (Service Worker)] が本物の fetch() を実行
   ↓ リダイレクト追跡後、{ ok, status, url, redirected } を返却
[main.js] が結果をツールチップに表示
```

普通のページ側 JS からは CORS で遮断されるリクエストが、Service Worker 経由でブラウザの特権コンテキストから実行されるため成功します。

## 注意事項

- **プライバシー**: ホバーしただけで該当URLサーバーに HEAD リクエストが飛びます。リクエスト元はあなた自身のブラウザです（短縮サービス側のログに残る可能性あり）
- **キャッシュ**: 結果は「メモリ上のみ」キャッシュされます。ページを離れるとリセット
- **短縮URL側の仕様**: `t.co` はUser-Agent/Refererにより挙動が変わることがあり、リダイレクト先が取れないケースもあります

## 次のステップ

- [hello-world](../../example.com/hello-world/) — 入門（`addButton` / `getConfig` / `log`）
- [プラグイン開発ガイドの SDK リファレンス](../../../index.html#sdk) — 他のAPIの詳細
