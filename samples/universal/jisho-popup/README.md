# Jisho Popup

日本語テキストを選択してボタンを押すと、[Jisho.org](https://jisho.org/) の公開APIで辞書検索し、意味を**サイドパネル**に表示するWSIプラグインです。日本語学習者や英訳が必要な場面で活躍します。

## 学べること

このサンプルは **`WSI.fetch` で外部JSON APIを叩く** 典型パターンを示します。Jisho.org の API は CORS ヘッダーを返さないため、**ページから直接 `fetch()` しても遮断されます**。WSI.fetch は Service Worker 経由で実行されるので、CORS の壁を越えて結果を取得できます（WSI v1.3.0 から `body` を返すようになりました）。

| API | 役割 |
|---|---|
| **`WSI.fetch(url, { method: 'GET' })`** | Jisho API を叩き、`res.body` で JSON を取得 |
| `WSI.addPanel(options)` | 検索結果をサイドパネルに表示 |
| `WSI.addButton(options)` | 検索実行用のボタン |
| `WSI.getConfig()` | API URL、表示件数、パネル位置などをユーザ設定可能に |
| `window.getSelection()` | ユーザが選択したテキストを取得 |

## ファイル構成

```
jisho-popup/
├── plugin.json       # 辞書API URL・表示件数などを config で管理
├── main.js           # 選択 → API呼び出し → パネル表示（~130行）
├── style.css         # 辞書エントリとパネル内のスタイル
├── README.md
└── jisho-popup.zip   # WSI にインポートする配布用 ZIP
```

## 必要なWSIバージョン

- **WSI v1.3.0 以上** — `WSI.fetch` のレスポンスボディ対応が必要

## インストール手順

1. WSI v1.3.0 以上を読み込む（[src/](../../../src/) を「パッケージ化されていない拡張機能を読み込む」）
2. WSI アイコン → 「プラグインを追加」 → [jisho-popup.zip](jisho-popup.zip)
3. 任意のサイトを開き、画面右上に「辞」ボタンが表示されることを確認

## 使い方

1. ページ上の日本語テキストを選択（例: 「猫」「勉強する」「走る」）
2. 画面右上の「辞」ボタンをクリック
3. 右側にサイドパネルが開き、検索中 → 辞書結果が表示される

### 試すのに良いページ

- **Wikipedia 日本語版** — 本文中の単語を選択して検索
- **青空文庫** — 古い言い回しの意味を調べる
- **Qiita / Zenn** — 技術用語の英訳を確認

### 例: 「猫」を検索した場合

```
🔍 猫

猫 【ねこ】
  1. Noun — cat (esp. the domestic cat, Felis catus)
  2. Noun — shamisen
  3. Noun — wheelbarrow
...
```

## カスタマイズ

`plugin.json` の `config` で挙動を変更できます。

```json
"config": {
  "buttonPosition": "bottom-left",
  "panelPosition": "right",
  "panelWidth": "380px",
  "maxResults": 10,
  "maxSensesPerEntry": 3,
  "apiUrl": "https://jisho.org/api/v1/search/words"
}
```

> **ヒント**: `buttonPosition` を `panelPosition` と同じ側（例: どちらも right）に設定するとパネルの × ボタンと衝突します。デフォルトは反対側に配置しています。

- **`maxResults`** — 表示する辞書エントリ数の上限（Jisho APIは最大20件）
- **`maxSensesPerEntry`** — 1エントリあたりの語義表示上限（同音異義の整理）
- **`apiUrl`** — 自前のプロキシサーバー等、別のJisho互換APIを使いたい場合に変更

## 内部の仕組み

```
[日本語テキスト選択]
    ↓
[「辞」ボタンクリック]
    ↓
window.getSelection().toString().trim()
    ↓
WSI.fetch('https://jisho.org/api/v1/search/words?keyword=...', {method: 'GET'})
    ↓ postMessage → content script → runtime.sendMessage
    ↓
[background.js (Service Worker)]
    fetch() ← CORS を迂回
    res.text() でボディ取得
    ↓
{ ok, status, url, redirected, body }
    ↓ 逆ルートで plugin へ
[main.js]
    JSON.parse(res.body)
    renderResults() で HTML 生成
    panel.children[1].innerHTML = html
```

## なぜ `WSI.fetch` が必要か

Jisho.org API にページJSから直接 `fetch()` すると:

```javascript
fetch('https://jisho.org/api/v1/search/words?keyword=猫')
// → CORS error: Access-Control-Allow-Origin ヘッダが無い
```

Jisho の公開APIは `Access-Control-Allow-Origin` を返さないため、ブラウザのCORS保護で**ページJSからは読めません**。一方、Chrome拡張機能の Service Worker は `host_permissions` を持っていればこの制限を受けません。WSI は「メインワールドで実行されるプラグインコード」と「拡張機能の Service Worker」の橋渡しをすることで、プラグイン作者に `fetch()` っぽいシンプルなAPIを提供しています。

## 制限事項

- **単語単位の検索のみ** — 文全体を選択してもうまく動きません。適切な単語を選択してください
- **Jisho.org のレート制限** — 過剰リクエストに対してはAPI側でレート制限がかかる可能性があります（個人利用ペースなら問題なし）
- **英日検索は未対応** — このプラグインはJisho APIへの「日→英」方向の検索のみです。逆方向もAPI自体は対応していますが、`main.js` 側の表示ロジックが和英辞書形式になっているため

## 応用アイデア

- **Cambridge Dictionary API** や **Wikipedia API** への差し替え
- 選択テキストをDeepL等の翻訳APIに投げる
- 郵便番号検索、株価取得、RSSフィード取得など、JSONを返す任意のAPIに展開可能

いずれも `apiUrl` と `renderResults` を書き換えるだけで実装できます。

## 次のステップ

- [hello-world](../../example.com/hello-world/) — 入門
- [url-expander](../url-expander/) — `WSI.fetch` の HEAD + リダイレクト追跡
- [outline-panel](../outline-panel/) — `WSI.addPanel` の別用途
