# Markdown Copy

ページで選択したテキストを **Markdown形式**（`[text](url)` など）でクリップボードにコピーするWSIプラグインです。ノート作成、記事執筆での引用、Issue / PR への情報共有などに便利です。

## 学べること

このサンプルは、**メインワールドで実行されるWSIプラグインならではの強み** — 「ページ側のJavaScript APIにそのままアクセスできる」を示します。`window.getSelection()` の Range API と `navigator.clipboard` を組み合わせた DOM 走査の実例です。

| API | 役割 |
|---|---|
| `WSI.addButton(options)` | 画面右下にフローティングボタンを追加 |
| `WSI.getConfig()` | 引用文付与の有無、ボタン位置を `config` から取得 |
| `window.getSelection()` + `Range.cloneContents()` | ユーザの選択範囲の構造を保ったまま抽出 |
| `navigator.clipboard.writeText()` | クリップボードへ書き込み（ボタンクリックのユーザジェスチャ下で実行） |

## ファイル構成

```
markdown-copy/
├── plugin.json        # 設定: 引用文付与 / ボタン位置
├── main.js            # 選択範囲→Markdown変換ロジック（~90行）
├── style.css          # フィードバックToastのスタイル
├── README.md
└── markdown-copy.zip  # WSI にインポートする配布用 ZIP
```

## インストール手順

1. [WSI 拡張機能のインストール](../../../index.html#quick-start)を完了しておく
2. WSI アイコン → 「プラグインを追加」 → [markdown-copy.zip](markdown-copy.zip)
3. 任意のサイトを開いて画面右下に「📋 MD」ボタンが表示されることを確認

## 使い方

1. ページ上で任意のテキストを選択（通常のドラッグ選択でOK）
2. 画面右下の「📋 MD」ボタンをクリック
3. 画面上部に「コピーしました ✓」と表示されればクリップボードに入っています
4. Markdown対応エディタ（Zenn / GitHub Issue / Obsidian など）に貼り付けて確認

## 変換ルール

| HTML | Markdown |
|---|---|
| `<a href="url">text</a>` | `[text](url)` |
| `<strong>`, `<b>` | `**text**` |
| `<em>`, `<i>` | `*text*` |
| `<code>` (inline) | `` `text` `` |
| `<pre><code>...</code></pre>` | フェンス付きコードブロック |
| `<h1>` 〜 `<h6>` | `#` 〜 `######` |
| `<blockquote>` | `> text` |
| `<ul>/<li>` | `- item` |
| `<ol>/<li>` | `1. item` |
| `<img src="url" alt="alt">` | `![alt](url)` |
| `<hr>` | `---` |

## カスタマイズ

`plugin.json` の `config` で挙動を変更できます。

```json
"config": {
  "includeCitation": true,
  "buttonPosition": "bottom-right"
}
```

- **`includeCitation`** — `true` にすると、コピー内容の末尾に `— [ページタイトル](URL)` が追加されます
- **`buttonPosition`** — `bottom-right` / `bottom-left` / `top-right` / `top-left` から選択

`includeCitation: true` で選択後のクリップボード内容の例:

```
選択したテキスト。**太字** もあるし、[リンク](https://example.com/linked) も変換される。

— [元ページのタイトル](https://example.com/article)
```

## 制限事項

- **ネストしたリスト** はフラット化されます（インデント未対応）
- **表（`<table>`）** は未変換（そのままテキスト化される）
- **数式（MathML / KaTeX）** は未対応
- `navigator.clipboard` が使えない環境（古いブラウザや一部の iframe 環境）では失敗します

## 内部の仕組み

```
[ユーザがテキスト選択]
    ↓
[📋 MDボタンクリック]
    ↓
window.getSelection().getRangeAt(0).cloneContents()
    → DocumentFragment（選択範囲の構造コピー）
    ↓
再帰的に node を走査し、tagごとにMarkdownへ変換
    ↓
navigator.clipboard.writeText() でクリップボードへ
```

メインワールドで動作しているため、`window.getSelection()` / `navigator.clipboard` / `document.baseURI` などのページ側 API が何の橋渡しもなしに使えます。

## 次のステップ

- [hello-world](../../example.com/hello-world/) — 入門（`addButton` / `getConfig` / `log`）
- [url-expander](../url-expander/) — `WSI.fetch` の CORS 回避デモ
