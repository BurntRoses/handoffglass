/** Unsigned engineering preview; use signing/notarization only with configured credentials. */
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const native = process.platform === 'darwin'
  ? [{ from: 'native/macos/hg-locate', to:'native/hg-locate' }]
  : process.platform === 'win32'
    ? [{ from: 'native/windows/locate.ps1', to:'native/locate.ps1' }] : [];
if (process.platform === 'darwin' && !existsSync(join(__dirname,'native/macos/hg-locate')))
  throw new Error('Compile native macOS helper first: npm run native:macos');
module.exports = {
  appId: 'dev.handoffglass.desktop', productName: 'HandoffGlass',
  asar: true, directories: { output: 'dist' },
  files: [ 'src/**', 'assets/brandmark.svg', 'package.json' ],
  extraResources: native,
  mac: { icon: 'build/icons/icon.icns', target: ['zip'], category: 'public.app-category.productivity', identity: null,
    hardenedRuntime: false },
  win: { icon: 'build/icons/icon.ico', target: ['nsis', 'portable'] },
  nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true },
  linux: { icon: 'build/icons', target: ['AppImage'], category: 'Utility' },
  publish: null
};
