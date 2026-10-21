/** Probe the installed executable without starting Electron or inspecting a desktop. */
import { createRequire } from 'node:module';
import { statSync, accessSync, constants } from 'node:fs';
const require = createRequire(import.meta.url);
export function desktopRuntimeStatus({resolvePackage = () => require.resolve('electron'),
  loadExecutable = () => require('electron'), checkExecutable = path => {
    if (!statSync(path).isFile()) throw new Error('Not a file');
    accessSync(path, constants.X_OK);
  }} = {}) {
  try { resolvePackage(); } catch { return {available:false,code:'electron_not_installed'}; }
  try {
    const path = loadExecutable();
    if (typeof path !== 'string' || !path) throw new Error('No executable path');
    checkExecutable(path);
    return {available:true,code:'ready'};
  } catch { return {available:false,code:'electron_runtime_missing',recovery:'Install the Electron runtime: node node_modules/electron/install.js; then rerun doctor --desktop.'}; }
}
