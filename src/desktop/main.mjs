import { app, BrowserWindow, screen, ipcMain, session, Menu, Tray, nativeImage, shell, dialog, clipboard } from 'electron';
import { hostConfig } from '../config.mjs';
import { showSetup, registerSetupIPC, maybeShowFirstRun } from './setup.mjs';
import { getAccessibilityConsent, setAccessibilityConsent } from '../native/preferences.mjs';
import { loadPreferences, savePreferences, VISUAL_STYLES, MOTION_MODES } from '../local/preferences.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localAnnotations, contains } from '../geometry.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.HANDOFFGLASS_PORT);
const secret = process.env.HANDOFFGLASS_SECRET;
if (!Number.isInteger(port) || port < 1 || port > 65535 || !/^[a-f0-9]{64}$/.test(secret || '')) {
  console.error('Missing or invalid local bridge configuration');
  process.exit(1);
}
const endpoint = `http://127.0.0.1:${port}`;
const headers = { authorization: `Bearer ${secret}`, 'content-type': 'application/json' };
const nap = ms => new Promise(resolve => setTimeout(resolve, ms));
let overlays = [], panel = null, current = null, closing = false, revision = -1, displayDebounce = null, tray = null;

async function call(method, path, body) {
  const res = await fetch(endpoint + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(16000)
  });
  if (!res.ok) throw new Error(`Local bridge: HTTP ${res.status}`);
  return res.json();
}
function lockDown(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('will-attach-webview', event => event.preventDefault());
}
function info() {
  return screen.getAllDisplays().map(d => ({
    id: String(d.id), x: d.bounds.x, y: d.bounds.y,
    width: d.bounds.width, height: d.bounds.height, scaleFactor: d.scaleFactor,
    ...(process.platform === 'win32' ? { physicalBounds: screen.dipToScreenRect(null, d.bounds) } : {})
  }));
}
function createOverlay(display) {
  const b = display.bounds;
  const win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    frame: false, transparent: true, backgroundColor: '#00000000',
    hasShadow: false, show: false, skipTaskbar: true, resizable: false,
    focusable: false, alwaysOnTop: true,
    webPreferences: {
      preload: join(here, 'preload.cjs'), contextIsolation: true,
      sandbox: true, nodeIntegration: false, webSecurity: true
    }
  });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setAlwaysOnTop(true, 'screen-saver');
  if (process.platform === 'darwin') win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  lockDown(win);
  void win.loadFile(join(here, 'overlay.html'));
  win.webContents.on('did-finish-load', () => draw(win, display));
  return { win, display };
}
function createPanel() {
  const win = new BrowserWindow({
    width: 440, height: 342, minWidth: 440, minHeight: 342,
    show: false, skipTaskbar: true, frame: false, transparent: false,
    alwaysOnTop: true, resizable: false, backgroundColor: '#101923',
    webPreferences: {
      preload: join(here, 'preload.cjs'), contextIsolation: true,
      sandbox: true, nodeIntegration: false, webSecurity: true
    }
  });
  win.setAlwaysOnTop(true, 'screen-saver', 1);
  if (process.platform === 'darwin') win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  lockDown(win);
  void win.loadFile(join(here, 'panel.html'));
  win.on('close', evt => { if (!closing) { evt.preventDefault(); win.hide(); } });
  win.webContents.on('did-finish-load', () => { if (current) win.webContents.send('hg:render', current); });
  return win;
}
function draw(win, display) {
  if (win.isDestroyed() || win.webContents.isLoading()) return;
  const b = { id: String(display.id), x: display.bounds.x, y: display.bounds.y, width: display.bounds.width, height: display.bounds.height };
  const annotations = current ? localAnnotations(b, current.annotations) : [];
  if (!annotations.length) { win.hide(); return; }
  win.webContents.send('hg:render', { annotations, visualStyle: current?.visualStyle, motion: current?.motion });
  win.showInactive();
}
function findTargetDisplay(active) {
  const first = active?.annotations?.[0];
  return (first && screen.getAllDisplays().find(d => contains({
    x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height
  }, first))) || screen.getPrimaryDisplay();
}
function applySnapshot(state) {
  if (!state || !Number.isSafeInteger(state.revision) || state.revision < revision) return;
  revision = state.revision;
  updateUI(state.active);
}
function updateUI(next) {
  current = next?.status === 'awaiting_user' ? next : null;
  for (const { win, display } of overlays) draw(win, display);
  if (!panel) return;
  // Plain visual_show is non-blocking: no panel to dismiss or steal focus.
  if (!current || current.mode === 'guide') { panel.hide(); return; }
  const area = findTargetDisplay(current).workArea;
  const target = current.annotations?.[0];
  const placeLeft = target && target.x > area.x + area.width * 0.55;
  const x = placeLeft ? area.x + 12 : area.x + Math.max(8, area.width - 456);
  panel.setPosition(Math.round(x), Math.round(area.y + Math.max(8, area.height - 358)));
  if (!panel.webContents.isLoading()) panel.webContents.send('hg:render', current);
  panel.showInactive();
  panel.moveTop();
}
function syncDisplays() {
  for (const { win } of overlays) if (!win.isDestroyed()) win.destroy();
  overlays = screen.getAllDisplays().map(display => createOverlay(display));
  updateUI(current);
  void call('POST', '/hello', { displays: info() }).then(s => {
    applySnapshot(s);
  }).catch(err => console.error('[handoffglass] display sync failed:', err.message));
}
async function runLoop() {
  let failures = 0;
  while (!closing) {
    try {
      if (revision < 0 || failures) {
        const state = await call('POST', '/hello', { displays: info() });
        applySnapshot(state);
      }
      const next = await call('GET', `/poll?after=${revision}`);
      applySnapshot(next);
      failures = 0;
    } catch (error) {
      if (closing) break;
      failures++;
      console.error(`[handoffglass] UI sync retry ${failures}: ${error.message}`);
      if (failures >= 8) break;
      await nap(Math.min(3000, 300 * failures));
    }
  }
  app.quit();
}
await app.whenReady();
session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
app.on('window-all-closed', () => {});
app.on('before-quit', () => { closing = true; });
panel = createPanel();
async function setupTrayAndMenu() {
  const visualPrefs = await loadPreferences();
  const styleOptions = VISUAL_STYLES.map(value => ({
    label: `Visual: ${value}`, type: 'radio', checked: visualPrefs.visualStyle === value,
    click: async () => { try { await savePreferences({visualStyle: value}); }
      catch(error) { dialog.showErrorBox('Visual preference', error.message); } }
  }));
  const motionOptions = MOTION_MODES.map(value => ({
    label: `Motion: ${value}`, type: 'radio', checked: visualPrefs.motion === value,
    click: async () => { try { await savePreferences({motion: value}); }
      catch(error) { dialog.showErrorBox('Motion preference', error.message); } }
  }));
  const item = { label: 'Enable read-only UI element inspection', type: 'checkbox',
    checked: await getAccessibilityConsent(), click: async menuItem => {
      try { await setAccessibilityConsent(menuItem.checked); }
      catch (error) { dialog.showErrorBox('Accessibility setting failed', error.message); menuItem.checked = !menuItem.checked; }
    }};
  const languageOptions = [['zh-CN','简体中文'],['en-US','English']].map(([value,label])=>({
    label,type:'radio',checked:visualPrefs.locale===value,
    click:async()=>{try{await savePreferences({locale:value});}catch(error){dialog.showErrorBox('Language preference',error.message);}}
  }));
  const densityOptions = [['normal','Comfortable'],['compact','Compact']].map(([value,label])=>({
    label,type:'radio',checked:visualPrefs.density===value,
    click:async()=>{try{await savePreferences({density:value});}catch(error){dialog.showErrorBox('Density preference',error.message);}}
  }));
  const context = Menu.buildFromTemplate([
    { label: 'Setup & Agent connections…', click: () => void showSetup() },
    { label: 'Show current handoff', click: () => { if (current?.mode === 'handoff') { panel.showInactive(); panel.moveTop(); } } },
    item,
    { label: 'Visual style (next handoff)', submenu: styleOptions },
    { label: 'Animation level (next handoff)', submenu: motionOptions },
    { label: 'Language (next handoff)', submenu: languageOptions },
    { label: 'Information density (next handoff)', submenu: densityOptions },
    { label: 'Copy MCP configuration (Claude/Cursor/Cline)', click: () => {
      const entry = app.isPackaged ? join(process.resourcesPath,'app.asar','src','mcp.mjs') : join(here,'..','mcp.mjs');
      const config = hostConfig('claude',{command:process.execPath,entry,compact:true,
        envOverrides:{ ELECTRON_RUN_AS_NODE:'1' }});
      clipboard.writeText(config);
      dialog.showMessageBox({type:'info',title:'HandoffGlass MCP configuration copied',
        message:'Paste this mcpServers entry into your local Agent settings. For Codex, use the TOML equivalent.',
        detail: process.platform==='win32' ? 'For reliable Agent startup on Windows, install the desktop application to a stable path; portable temp directories may change.' :
          'Use the same macOS user and this application location. No remote/cloud Agent will automatically see your local screen.'});
    } },
    { label: 'Accessibility permission settings', click: () => {
      if (process.platform === 'darwin') void shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
      else if (process.platform === 'win32') void shell.openExternal('ms-settings:privacy');
    } },
    { type: 'separator' },
    { label: 'Quit HandoffGlass', click: () => app.quit() }
  ]);
  Menu.setApplicationMenu(context);
  try {
    const icon = nativeImage.createFromPath(join(here,'assets','tray.png'));
    if (!icon.isEmpty()) { tray = new Tray(icon); tray.setToolTip('HandoffGlass'); tray.setContextMenu(context); tray.on('double-click', () => { if (current?.mode === 'handoff') panel.showInactive(); }); }
  } catch (error) { console.warn('Tray unavailable:',error.message); }
}
registerSetupIPC();
await setupTrayAndMenu();
syncDisplays();
void maybeShowFirstRun().catch(error => console.error('First-run setup:', error.message));
function requestDisplaySync() {
  clearTimeout(displayDebounce);
  displayDebounce = setTimeout(syncDisplays, 140);
}
screen.on('display-added', requestDisplaySync);
screen.on('display-removed', requestDisplaySync);
screen.on('display-metrics-changed', requestDisplaySync);
ipcMain.handle('hg:decision', async (event, data) => {
  if (!panel || event.sender !== panel.webContents || !current) return { ok: false, error: 'Session unavailable' };
  if (data?.id !== current.id || !['completed', 'declined', 'cancelled'].includes(data.status)) {
    return { ok: false, error: 'Stale or invalid decision' };
  }
  try {
    const result = await call('POST', '/decision', { id: current.id, status: data.status });
    if (result.session?.id !== data.id || result.session.status !== data.status) {
      return { ok: false, error: 'Session state changed; review before retrying' };
    }
    if (current?.id === data.id) updateUI(null);
    return { ok: true, sessionId: data.id, status: data.status };
  } catch (error) {
    console.error('[handoffglass] decision failed:', error.message);
    return { ok: false, error: 'Could not deliver decision; please retry after checking the panel' };
  }
});
void runLoop();
