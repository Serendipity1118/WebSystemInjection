const JSZip = require('jszip');

async function createPluginZip(pluginDef, mainJsCode, cssCode) {
  const zip = new JSZip();
  zip.file('plugin.json', JSON.stringify(pluginDef, null, 2));
  zip.file(pluginDef.scripts.main, mainJsCode);
  if (cssCode && pluginDef.styles && pluginDef.styles.length > 0) {
    zip.file(pluginDef.styles[0], cssCode);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

function samplePluginDef(overrides = {}) {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'テスト用プラグイン',
    author: 'Test Author',
    domains: ['example.com'],
    scripts: { main: 'main.js', runAt: 'document_idle' },
    styles: [],
    config: { message: 'Hello Test' },
    ...overrides,
  };
}

const SAMPLE_MAIN_JS = `
WSI.addButton({
  text: "Test",
  icon: "T",
  position: "bottom-right",
  onClick: () => {
    WSI.log("button clicked");
  }
});
WSI.log("test plugin loaded");
`;

module.exports = { createPluginZip, samplePluginDef, SAMPLE_MAIN_JS };
