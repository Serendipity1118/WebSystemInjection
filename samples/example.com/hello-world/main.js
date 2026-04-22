// WSI サンプル: Hello World
// 使用SDK: WSI.getConfig / WSI.addButton / WSI.log

// plugin.json の "config" フィールドに書いた値を読み取る
const config = WSI.getConfig();

// 画面にフローティングボタンを追加する
WSI.addButton({
  text: "👋",
  position: "bottom-right",
  onClick: () => {
    // config から読んだメッセージをダイアログ表示
    alert(config.message);
    // [WSI:hello-world] プレフィックス付きでコンソール出力
    WSI.log("ボタンがクリックされました");
  }
});

WSI.log("Hello World プラグインが読み込まれました");
