/** Packaged GUI entry: self-hosts the broker so ordinary users need no Node installation. */
import { app, dialog } from 'electron';
import { resolve, join } from 'node:path';
import { rm, mkdir, stat } from 'node:fs/promises';
import { HandoffManager } from '../core.mjs';
import { LocalBridge } from '../bridge.mjs';
import { runtimeDir, secureRuntimeDir, readManifest, writeManifest, probe } from '../runtime.mjs';

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    dialog.showMessageBox({ type:'info', title:'HandoffGlass', message:'HandoffGlass is already running.' });
  });
  await app.whenReady();
  const dir = await secureRuntimeDir(runtimeDir());
  const lock = join(dir,'.startup-lock');
  let acquired = false, manager, bridge, exiting = false, ready = false;
  try {
    // Cooperate with the stdio MCP runtime's broker-startup lock.
    for (let i = 0; i < 75; i++) {
      try { await mkdir(lock, { mode: 0o700 }); acquired = true; break; }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        try { const s = await stat(lock); if (Date.now() - s.mtimeMs > 25000) await rm(lock, {recursive:true,force:true}); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        await new Promise(r => setTimeout(r, 120));
      }
    }
    if (!acquired) throw new Error('Could not acquire local startup lock');
    const active = await readManifest(dir);
    if (active && await probe(active)) throw new Error('Another HandoffGlass broker is running. Stop it with npm run broker:stop before starting the desktop app.');
    if (active) await rm(join(dir,'broker.json'), {force:true});
    manager = new HandoffManager();
    bridge = new LocalBridge(manager);
    await bridge.start();
    await writeManifest(dir, { port:bridge.port, token:bridge.agentToken, pid:process.pid, startedAt:Date.now(), protocol:1 });
    process.env.HANDOFFGLASS_PORT = String(bridge.port);
    process.env.HANDOFFGLASS_SECRET = bridge.token;
    if (app.isPackaged) process.env.HANDOFFGLASS_NATIVE_RESOURCE_DIR = resolve(process.resourcesPath,'native');
    ready = true;
  } catch (error) {
    dialog.showErrorBox('HandoffGlass cannot start', error.message);
    app.quit();
  } finally {
    if (acquired) await rm(lock,{recursive:true,force:true});
  }
  if (ready) {
    app.on('before-quit', () => {
      if (exiting) return;
      exiting = true;
      manager.close();
      void bridge.stop().finally(async () => {
        try {
          const live = await readManifest(dir);
          if (live?.pid === process.pid && live.token === bridge.agentToken) await rm(join(dir,'broker.json'),{force:true});
        } catch (error) { console.error('Cleanup:',error.message); }
      });
    });
    await import('./main.mjs');
  }
}
