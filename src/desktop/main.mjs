import { app, BrowserWindow, screen, ipcMain, session, Menu, Tray, nativeImage } from 'electron';
import { registerSetupIPC, maybeShowFirstRun } from './setup.mjs';
import { showControlCenter, registerCenterIPC } from './center.mjs';
import { loadPreferences } from '../local/preferences.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { placePanel } from './panel-layout.mjs';
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
    // macOS otherwise constrains this window to the work area on first show,
    // shifting global-DIP annotations below the menu bar (and sometimes right).
    enableLargerThanScreen: true,
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
  // isLoading() can still be true during did-finish-load. Rebuilt overlays need
  // a redraw after loading stops even when no new session revision arrives.
  win.webContents.on('did-stop-loading', () => draw(win, display));
  return { win, display };
}
function createPanel() {
  const win = new BrowserWindow({
    width: 420, height: 238, minWidth: 420, minHeight: 238,
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
  // Handoff sessions use a local scrim to focus attention while the SVG layer
  // remains click-through. The human-facing card is the only interactive UI.
  if (current?.mode === 'handoff' && annotations.length && !annotations.some(a => a.shape === 'spotlight')) {
    const focus = annotations[0];
    annotations.unshift({ ...focus, id: '__session_spotlight', shape: 'spotlight', opacity: .92, effect: 'still', label: '' });
  }
  // Clear the renderer's playback cache when a target is lost, even while hidden.
  win.webContents.send('hg:render', { sessionId: current?.id, annotations, visualStyle: current?.visualStyle, motion: current?.motion });
  if (!annotations.length) { win.hide(); return; }
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
  current = next && ['awaiting_user','user_action_reported','observing'].includes(next.status) ? next : null;
  for (const { win, display } of overlays) draw(win, display);
  if (!panel) return;
  // Plain visual_show is non-blocking: no panel to dismiss or steal focus.
  if (!current || current.mode === 'guide') { panel.hide(); return; }
  const area = findTargetDisplay(current).workArea;
  const target = current.annotations?.[0];
  if(current.status==='awaiting_user'){const {x,y}=placePanel(area,target);panel.setPosition(x,y);}
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
      const response=await fetch(`${endpoint}/desktop/stream`,{headers:{authorization:`Bearer ${secret}`}});
      if(!response.ok)throw Error(`Desktop stream ${response.status}`);
      let buffer='';const decoder=new TextDecoder();
      for await(const chunk of response.body){
        buffer+=decoder.decode(chunk,{stream:true});
        let end;
        while((end=buffer.indexOf('\n\n'))>=0){
          const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);
          if(frame.startsWith('data: '))applySnapshot(JSON.parse(frame.slice(6)));
        }
        if(closing)break;
      }
      if(!closing)throw Error('Desktop stream closed');
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
// Electron emits ready only after its ESM entry finishes loading. Do not await
// readiness at module scope: both direct and broker-launched entrypoints stall.
async function startDesktop() {
  await app.whenReady();
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => { closing = true; });
  panel = createPanel();
  async function setupTrayAndMenu() {
    const prefs = await loadPreferences(),zh=prefs.locale==='zh-CN';
    const open=()=>void showControlCenter();
    const items=[
      {label:zh?'打开 HandoffGlass':'Open HandoffGlass',click:open},
      {label:zh?'当前操作':'Current step',click:()=>{if(current?.mode==='handoff'){panel.showInactive();panel.moveTop();}}},
      {type:'separator'},
      {label:zh?'退出 HandoffGlass':'Quit HandoffGlass',role:'quit'}
    ];
    const context=Menu.buildFromTemplate(items);
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {label:'HandoffGlass',submenu:[{label:zh?'设置…':'Settings…',accelerator:'CmdOrCtrl+,',click:open},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]},
      {role:'editMenu'},{role:'windowMenu'}
    ]));
    try {
      if(!tray){
        const icon=nativeImage.createFromPath(join(here,'assets',process.platform==='darwin'?'tray.png':'app.png'));
        if(process.platform==='darwin')icon.setTemplateImage(true);
        if(!icon.isEmpty()){
          tray=new Tray(process.platform==='darwin'?icon:icon.resize({width:20,height:20}));
          tray.setToolTip('HandoffGlass');tray.on('double-click',open);
        }
      }
      tray?.setContextMenu(context);
    }catch(error){console.warn('Tray unavailable:',error.message);}
  }
  registerSetupIPC();
  registerCenterIPC({getDiagnostics:()=>call('GET','/desktop/diagnostics'),
    getDisplayInfo:()=>screen.getAllDisplays().map((d,i)=>({
      id:String(d.id),bounds:{x:d.bounds.x,y:d.bounds.y,width:d.bounds.width,height:d.bounds.height},
      scaleFactor:d.scaleFactor,primary:d.id===screen.getPrimaryDisplay().id,
      ...(process.platform==='win32'?{physicalBounds:screen.dipToScreenRect(null,d.bounds)}:{})
    }))});
  app.setName('HandoffGlass');
  if(process.platform==='darwin'&&!app.isPackaged)app.dock?.setIcon(join(here,'assets','app.png'));
  app.on('activate',()=>void showControlCenter());
  app.on('hg:preferences-changed',()=>void setupTrayAndMenu());
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
      if (result.session?.id !== data.id || !(result.session.status === data.status || (data.status==='completed' && result.session.status==='user_action_reported'))) {
        return { ok: false, error: 'Session state changed; review before retrying' };
      }
      // SSE can arrive before this HTTP response. Use its revision so an older
      // response cannot hide verification or overwrite the Agent's next step.
      applySnapshot(result);
      return { ok: true, sessionId: data.id, status: data.status };
    } catch (error) {
      console.error('[handoffglass] decision failed:', error.message);
      return { ok: false, error: 'Could not deliver decision; please retry after checking the panel' };
    }
  });
  void runLoop();
}
void startDesktop().catch(error => {
  console.error('[handoffglass] Desktop startup failed:', error);
  app.exit(1);
});
