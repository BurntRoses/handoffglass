/** Unsigned engineering preview; use signing/notarization only with configured credentials. */
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
const { version } = require('./package.json');
const { packages } = require('./package-lock.json');
// Electron's npm downloader is needed only by source installs. Ship the app's
// embedded runtime once, without its installer or optional download dependencies.
const optionalPackages = Object.entries(packages).filter(([path,info]) => path.startsWith('node_modules/') && (info.optional || info.devOptional))
  .map(([path]) => `!${path}/**`);
const git = args => { try { return execFileSync('git', args, {cwd:__dirname,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); } catch { return null; } };
const commit = git(['rev-parse', 'HEAD']);
const changes = git(['status', '--porcelain']);
const native = process.platform === 'darwin'
  ? [{ from: 'native/macos/hg-locate', to:'native/hg-locate' }]
  : process.platform === 'win32'
    ? [{ from: 'native/windows/locate.ps1', to:'native/locate.ps1' }] : [];
if (process.platform === 'darwin' && !existsSync(join(__dirname,'native/macos/hg-locate')))
  throw new Error('Compile native macOS helper first: npm run native:macos');
module.exports = {
  appId: 'dev.handoffglass.desktop', productName: 'HandoffGlass',
  asar: true, directories: { output: process.env.HANDOFFGLASS_DIST_DIR || `dist/desktop-${process.platform}-${process.arch}` },
  extraMetadata: { handoffglassBuild: { schemaVersion:1, version, commit, dirty: changes === null || changes.length > 0, channel:'engineering-preview' } },
  files: [ 'src/**', 'skills/visual-handoff/**', 'integrations/workbuddy/connector-meta.json', 'integrations/workbuddy/icon.svg', 'assets/brandmark.svg', 'package.json', 'LICENSE', 'NOTICE', ...optionalPackages ],
  extraResources: [...native, { from:'build/notices', to:'notices' }],
  afterAllArtifactBuild: async result => (await import('./scripts/release-build-receipt.mjs')).recordBuiltArtifacts(result),
  mac: { icon: 'build/icons/icon.icns', target: ['zip'], category: 'public.app-category.productivity', identity: null,
    hardenedRuntime: false, artifactName:'HandoffGlass-${version}-mac-${arch}.${ext}' },
  win: { icon: 'build/icons/icon.ico', target: ['nsis', 'portable'] },
  nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall:false, artifactName:'HandoffGlass-${version}-windows-${arch}-setup.${ext}' },
  portable: { artifactName:'HandoffGlass-${version}-windows-${arch}-portable.${ext}' },
  linux: { icon: 'build/icons', target: ['AppImage'], category: 'Utility' },
  publish: null
};
