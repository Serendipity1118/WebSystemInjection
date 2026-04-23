# Outline Panel

ページ内の **h1〜h6 見出し** を収集してサイドパネルに目次（TOC）を表示するWSIプラグインです。クリックで該当見出しにスムーズスクロール、現在読んでいる位置を自動ハイライトします。長文記事・ドキュメント・仕様書・論文の閲覧に便利。

## 学べること

このサンプルは **`WSI.addPanel` の実用例** を示します。他のサンプルが `addButton` ベースなのに対し、これはサイドパネルUIの作り方・更新方法・スクロール連動を教材としています。

| API | 役割 |
|---|---|
| **`WSI.addPanel(options)`** | 画面右側にサイドパネルを表示。`title` / `width` / `position` / `content` / `onClose` を指定 |
| `WSI.addButton(options)` | パネル開閉用のトリガーボタン |
| `WSI.onPageLoad(callback)` | SPA の URL 変更を検知して TOC を再ビルド |
| `WSI.getConfig()` | ボタン・パネルの位置・幅を設定可能に |
| `Element.scrollIntoView({ behavior: 'smooth' })` | クリック時のスムーズスクロール |
| `requestAnimationFrame` | スクロール追従のスロットリング（60Hz に抑える） |

## ファイル構成

```
outline-panel/
├── plugin.json        # ボタン位置・パネル位置・パネル幅を config で指定
├── main.js            # TOC生成 / クリックナビ / アクティブ追跡（~100行）
├── style.css          # TOC階層スタイルとアクティブ表示
├── README.md
└── outline-panel.zip  # WSI にインポートする配布用 ZIP
```

## インストール手順

1. [WSI 拡張機能のインストール](../../../index.html#quick-start)を完了しておく
2. WSI アイコン → 「プラグインを追加」 → [outline-panel.zip](outline-panel.zip)
3. 見出しがあるページ（Wikipedia / Qiita / Zenn / GitHub README / MDN など）を開いて画面右上に 📑 ボタンが表示されることを確認

## 使い方

### 目次を開く
1. 📑 ボタンをクリック → 画面右にサイドパネルが表示
2. タイトル「目次 (N件)」に検出された見出しの数

### 移動する
- パネル内の見出しをクリック → 該当セクションへスムーズスクロール
- スクロール中、現在読んでいる位置の見出しがパネル内で青くハイライト

### 閉じる
- パネル右上の × ボタン

### SPA 対応
- Next.js / Nuxt / SPA フレームワークで URL 変更があった場合、パネルが開いていれば自動的に新ページの TOC に再構築（500ms 待機）

## 見出しの階層表示

h1〜h6 のレベルに応じてインデント16px刻みで表示。スタイルも強度を段階化:

| HTML | スタイル |
|---|---|
| `<h1>` | 太字・黒、最左 |
| `<h2>` | 中太、濃いグレー、16px字下げ |
| `<h3>` | 通常、ミドルグレー、32px字下げ |
| `<h4>`〜`<h6>` | 細字・小サイズ、48〜80px字下げ |

## カスタマイズ

`plugin.json` の `config` で表示位置を変更できます。

```json
"config": {
  "buttonPosition": "top-left",   // ボタン位置: bottom-right/bottom-left/top-right/top-left
  "panelPosition": "right",        // パネル位置: right / left
  "panelWidth": "320px"            // パネル幅: 任意のCSS幅（例: "280px", "25vw"）
}
```

> **ヒント**: `buttonPosition` と `panelPosition` を同じ側（どちらも `right` や `top-right` 系）に置くと、パネルを開いたときに閉じる × ボタンと 📑 ボタンが重なります。デフォルトは「ボタン左・パネル右」で互いに干渉しないようになっています。

## 内部の仕組み

```
[ユーザが 📑 ボタンクリック]
    ↓
document.querySelectorAll('h1, h2, h3, h4, h5, h6')
    ↓ 非表示要素を除外、text取得、id自動付与
[WSI.addPanel({ content: 生成HTML })]
    ↓ ページ右側に <div.wsi-panel> が挿入される
[click listener 付与] → 各 <a> で Element.scrollIntoView
[scroll listener (rAF)] → 見出し位置を測定してアクティブ更新
```

### アクティブ見出し判定ロジック

画面上部 30% (`window.innerHeight * 0.3`) をトリガーラインとして、このラインより上に位置している最後の見出しをアクティブとする仕組み。

```javascript
for (let i = 0; i < currentHeadings.length; i++) {
  if (currentHeadings[i].element.getBoundingClientRect().top <= triggerY) {
    activeIdx = i;
  } else break;  // 以降は画面下、見なくていい
}
```

## 制限事項

- **見出しの自動更新なし** — パネルを開いた時点のスナップショット。ページが動的に見出しを追加しても、パネルは更新されません（閉じて再度開けば再スキャン）
- **非 h1〜h6 の見出し未対応** — `[role="heading"]` や Medium のような特殊構造は無視されます
- **複数パネルの同時表示は非対応** — 開いた状態で再度ボタンを押すと、既存パネルを閉じて新たに開き直します
- **sticky なヘッダーを持つサイト** では、スクロール先が少し隠れることがあります（`scroll-margin-top` を CSS で調整するサイトが多い）

## 次のステップ

- [hello-world](../../example.com/hello-world/) — 入門
- [url-expander](../url-expander/) — `WSI.fetch` のCORS回避デモ
- [markdown-copy](../markdown-copy/) — 選択範囲のMarkdown変換
- [highlighter](../highlighter/) — `WSI.storage` の永続化デモ
