# Highlighter

ページ上の任意のテキストを選択してボタンを押すとマーカーでハイライトされ、**URL単位で永続化**されます。同じページを再訪すると自動復元。Alt+クリックで削除。読書メモや論文リーディングに使えます。

## 学べること

このサンプルは **`WSI.storage` の全APIを本格的に使う** 唯一のサンプルです。get / set / remove / getAll の4つすべてが登場します。

| API | このサンプルでの役割 |
|---|---|
| `WSI.storage.set(key, value)` | ページのハイライト配列を保存 |
| `WSI.storage.get(key)` | 既存ハイライトを取得して追記 |
| `WSI.storage.remove(key)` | ページのハイライトが全部消えたらキーごと削除（掃除） |
| `WSI.storage.getAll()` | 全ページの総ハイライト数を集計（デモ用途） |
| `WSI.addButton(options)` | ハイライト実行用のボタン |
| `WSI.onPageLoad(callback)` | SPAでURLが変わったときに復元を再実行 |
| `WSI.getConfig()` | 色とボタン位置をユーザー設定可能に |

加えて、DOM操作の教材として以下も含みます:
- `Range.surroundContents()` による要素ラップ
- `document.createTreeWalker()` による text node 走査（復元時の再検索）
- `NodeFilter` で自プラグインの span や toast を除外する方法

## ファイル構成

```
highlighter/
├── plugin.json      # 色・ボタン位置を config で指定
├── main.js          # ハイライト / 保存 / 復元 / 削除（~150行）
├── style.css        # ハイライト span と Toast のスタイル
├── README.md
└── highlighter.zip  # WSI にインポートする配布用 ZIP
```

## インストール手順

1. [WSI 拡張機能のインストール](../../../index.html#quick-start)を完了しておく
2. WSI アイコン → 「プラグインを追加」 → [highlighter.zip](highlighter.zip)
3. 任意のサイトを開き、画面左下に 🖍️ ボタンが表示されることを確認

## 使い方

### ハイライトする
1. ページでテキストを選択
2. 🖍️ ボタンをクリック
3. 選択範囲が黄色くマーキングされ、画面上部に「ハイライト保存（N件）」と表示

### 削除する
1. ハイライト部分を **Alt+クリック** （macOSでは Option+クリック）
2. 即座に削除され、storageからも消える

### 再訪時の復元
- 同じURLを再訪すると、ページ表示後に保存されたハイライトが自動復元
- SPA（React/Vue等）でURLが変わった場合も、500ms後に復元が再実行される

## カスタマイズ

`plugin.json` の `config` で色とボタン位置を変更できます。

```json
"config": {
  "color": "#fff59d",              // ハイライトの背景色（任意のCSSカラー）
  "buttonPosition": "bottom-left"  // bottom-right/bottom-left/top-right/top-left
}
```

色の例:
- `#fff59d` — 黄色（デフォルト、付箋風）
- `#a5d6a7` — 緑（重要）
- `#f48fb1` — ピンク（疑問）
- `#90caf9` — 青（参考）

## 内部の仕組み

### 保存
```
[選択範囲を取得]
    ↓
[Range.surroundContents(<span class="wsi-highlight">)]
    ↓ DOM上にマーキング
[WSI.storage.get(key)] → 既存配列を取得
    ↓ 追記
[WSI.storage.set(key, updated)]
```

ストレージキーは `hl:${location.origin}${location.pathname}` 形式。クエリやハッシュは無視することで、`?page=2` のようなページネーションや `#section` のアンカーがあっても同一ページとして扱います。

### 復元
```
[WSI.storage.get(key)] → 保存済みハイライト配列
    ↓ 各ハイライトについて
[TreeWalker で document.body のtext nodeを走査]
    ↓ 保存済みテキストを含む最初のnodeを発見
[Range作成 → surroundContents で再びspanでラップ]
```

テキストの一致のみで探索するので、ページの構造が大幅に変わっても「同じ文字列があれば」復元できます。逆に言うと、同じ文言が複数箇所ある場合は最初の出現位置にしか復元されません。

## 制限事項

- **要素境界をまたぐ選択**（例: 段落途中→次の見出しの途中）は `surroundContents` が失敗するためハイライトできません。エラートーストで通知します
- **同じ文字列が複数箇所**ある場合、復元時は**最初の出現位置のみ**がハイライトされます
- **動的に生成されるコンテンツ**（スクロール追加読み込みなど）は、読み込まれた時点では復元対象外です。再訪時のみ復元が試みられます
- **削除したテキスト**が復元対象だと、復元に失敗してログに残ります（エラーにはしない）
- **同時書き込みのレース**: 連続で複数箇所を素早くハイライトすると、稀にstorage更新が競合する可能性があります

## ストレージの中身を見るには

Chrome DevTools で:
1. `chrome://extensions` → WSI の詳細 → 「Service Worker」リンク
2. DevTools で `chrome.storage.local.get('pluginData_highlighter', console.log)` を実行
3. ハイライトがURL別に保存されているのが確認できます

## 次のステップ

- [hello-world](../../example.com/hello-world/) — 入門
- [url-expander](../url-expander/) — `WSI.fetch` のCORS回避デモ
- [markdown-copy](../markdown-copy/) — 選択範囲のMarkdown変換デモ
