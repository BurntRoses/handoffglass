import { app, BrowserWindow, screen, ipcMain, session } from 'electron';
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
let overlays = [], panel = null, current = null, closing = false, revision = -1;

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
    width: d.bounds.width, height: d.bounds.height, scaleFactor: d.scaleFactor
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
    width: 440, height: 334, minWidth: 440, minHeight: 334,
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
  win.webContents.send('hg:render', { annotations });
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
  if (!current) { panel.hide(); return; }
  const area = findTargetDisplay(current).workArea;
  panel.setPosition(Math.round(area.x + Math.max(8, area.width - 456)), Math.round(area.y + Math.max(8, area.height - 350)));
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
syncDisplays();
screen.on('display-added', syncDisplays);
screen.on('display-removed', syncDisplays);
screen.on('display-metrics-changed', syncDisplays);
ipcMain.on('hg:decision', async (event, data) => {
  if (!panel || event.sender !== panel.webContents || !current) return;
  if (data?.id !== current.id || !['completed', 'declined', 'cancelled'].includes(data.status)) return;
  try {
    await call('POST', '/decision', { id: current.id, status: data.status });
    if (current?.id === data.id) updateUI(null);
  } catch (error) { console.error('[handoffglass] decision failed:', error.message); }
});
void runLoop();
