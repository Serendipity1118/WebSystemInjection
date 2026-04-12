const config = WSI.getConfig();

WSI.addButton({
  text: "👋",
  position: "bottom-right",
  onClick: () => {
    alert(config.message);
    WSI.log("ボタンがクリックされました");
  }
});

WSI.log("Hello World プラグインが読み込まれました");
