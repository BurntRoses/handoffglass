/** Real renderer/window regression, launched by desktop-smoke in Electron. */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { app, BrowserWindow, screen } from 'electron';
import { HandoffManager } from '../src/core.mjs';
import { LocalBridge } from '../src/bridge.mjs';
import { savePreferences } from '../src/local/preferences.mjs';
import metadata from '../package.json' with { type: 'json' };

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, message) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await pause(50);
  }
  assert.fail(message);
}
// Keep the entry module synchronous so Electron can emit ready.
void app.whenReady().then(async () => {
  const dir = await mkdtemp(join(tmpdir(), 'handoffglass-windows-'));
  process.env.HANDOFFGLASS_RUNTIME_DIR = dir;
  const manager = new HandoffManager();
  const bridge = new LocalBridge(manager);
  try {
    await savePreferences({}, dir);
    await bridge.start();
    process.env.HANDOFFGLASS_PORT = String(bridge.port);
    process.env.HANDOFFGLASS_SECRET = bridge.token;
    await import('../src/desktop/main.mjs');
    await until(() => bridge.connected, 'Desktop did not attach');
    const target = new BrowserWindow({ width: 320, height: 180 });
    await target.loadURL('data:text/html,<title>HandoffGlass test target</title>Window geometry test');
    target.show();
    target.focus();
    await until(() => target.isFocused(), 'Test target did not receive focus');
    manager.show({ title: 'Window geometry regression', message: 'Synthetic display centers',
      mode: 'guide', timeoutSeconds: 30,
      annotations: bridge.displays.map(d => ({ x: d.x + d.width / 2, y: d.y + d.height / 2,
        width: 80, height: 50, shape: 'ring' })) });
    const overlays = () => BrowserWindow.getAllWindows().filter(w => w.webContents.getURL().endsWith('/overlay.html'));
    async function verify() {
      await until(() => overlays().length === screen.getAllDisplays().length &&
        overlays().every(w => w.isVisible()), 'Overlays did not become visible');
      const expected = screen.getAllDisplays().map(d => d.bounds);
      for (const win of overlays()) {
        assert.ok(expected.some(b => JSON.stringify(b) === JSON.stringify(win.getBounds())),
          `Overlay ${JSON.stringify(win.getBounds())} does not cover a display ${JSON.stringify(expected)}`);
        assert.equal(win.isFocusable(), false, 'Guide overlay must not accept focus');
      }
      assert.ok(target.isFocused(), 'Guide stole focus from the target');
      const panel = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/panel.html'));
      assert.equal(panel.isVisible(), false, 'Guide must not show the decision panel');
    }
    await verify();
    // Exercise the production display rebuild path without claiming a physical
    // multi-monitor/hotplug test on a machine with only one display attached.
    const old = overlays();
    screen.emit('display-metrics-changed', {}, screen.getPrimaryDisplay(), ['bounds']);
    await until(() => old.every(w => w.isDestroyed()), 'Display change did not rebuild overlays');
    await verify();
    console.log(`PASS window geometry: ${bridge.displays.length} display(s), exact global-DIP bounds, focus retained, display rebuild`);
    const { showControlCenter } = await import('../src/desktop/center.mjs');
    const center = await showControlCenter();
    // Verify the rendered readout uses the package version even when Electron
    // was launched directly with a .mjs entry (where app.getVersion may differ).
    let rendered;
    for (let i = 0; i < 50; i++) {
      rendered = await center.webContents.executeJavaScript('document.getElementById("appVersion").textContent');
      if (rendered === `v${metadata.version}`) break;
      await pause(50);
    }
    assert.equal(rendered, `v${metadata.version}`);
    center.close();
    console.log(`PASS Control Center: rendered version ${metadata.version}`);
  } finally {
    manager.close();
    await bridge.stop();
    await rm(dir, { recursive: true, force: true });
  }
}).then(() => app.exit(0), error => { console.error(error); app.exit(1); });
