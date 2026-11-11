import {desktopOwner} from './identity.mjs';
import { registerApplicationInstallation } from '../application-installation.mjs';
import { attachSessionCheckpoint } from '../local/session-checkpoint.mjs';
/** Packaged GUI entry: self-hosts the broker so ordinary users need no Node installation. */
import { app, dialog } from 'electron';
import { resolve, join } from 'node:path';
import { rm, mkdir, stat } from 'node:fs/promises';
import { HandoffManager } from '../core.mjs';
import { LocalBridge } from '../bridge.mjs';
import { runtimeDir, secureRuntimeDir, readManifest, writeManifest, writeDesktopManifest, readDesktopManifest, probe } from '../runtime.mjs';

if (app.isPackaged) process.env.HANDOFFGLASS_NATIVE_RESOURCE_DIR = resolve(process.resourcesPath, 'native');
function showStartupError(error){
  console.error('[handoffglass] Startup:',error.message);
  const zh=app.getLocale().startsWith('zh');
  const message=error.code==='already_running'
    ?(zh?'HandoffGlass 已在运行，请从菜单栏打开。':'HandoffGlass is running. Open it from the menu bar.')
    :(zh?'未能启动，请稍后重试。':'Could not start. Try again.');
  dialog.showErrorBox('HandoffGlass',message);
}


// A packaged Electron executable always loads package.json's main, even when
// the Broker supplies main.mjs as an argument. Join its authenticated Bridge
// instead of creating a competing Broker and waiting on our own startup lock.
if(!desktopOwner) {
  // The first desktop receives second-instance and opens its control center.
} else if (process.env.HANDOFFGLASS_PORT || process.env.HANDOFFGLASS_SECRET) {
  void import('./main.mjs').catch(error => {
    console.error('[handoffglass] Attached desktop startup failed:', error);
    app.exit(1);
  });
} else {
  // Leave ESM evaluation free to finish so Electron can emit ready.
  void app.whenReady().then(async () => {
    const dir = await secureRuntimeDir(runtimeDir());
    const lock = join(dir,'.startup-lock');
    let acquired = false, manager, bridge, checkpoint, exiting = false, ready = false;
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
      if(active && await probe(active)) {
        const desktop=await readDesktopManifest(dir);
        if(!desktop || desktop.pid!==active.pid || desktop.port!==active.port)throw new Error('Desktop discovery unavailable');
        process.env.HANDOFFGLASS_PORT=String(desktop.port);process.env.HANDOFFGLASS_SECRET=desktop.desktopToken;
        if(acquired){await rm(lock,{recursive:true,force:true});acquired=false;}
        if(app.isPackaged)await registerApplicationInstallation({dir,userHome:app.getPath('home'),appPath:process.platform==='darwin'?resolve(process.execPath,'../../..'):resolve(process.execPath,'..'),dataPaths:process.env.HANDOFFGLASS_RUNTIME_DIR?[]:[app.getPath('userData')],appVersion:app.getVersion()});
        await import('./main.mjs');
        await import('./center.mjs').then(m=>m.showControlCenter());
        return;
      }
      if (active) await rm(join(dir,'broker.json'), {force:true});
      if(app.isPackaged)try{await registerApplicationInstallation({dir,userHome:app.getPath('home'),appPath:process.platform==='darwin'?resolve(process.execPath,'../../..'):resolve(process.execPath,'..'),dataPaths:process.env.HANDOFFGLASS_RUNTIME_DIR?[]:[app.getPath('userData')],appVersion:app.getVersion()});}catch(error){console.warn('[handoffglass] Application removal record unavailable:',error.code||'identity_not_verified');}
      manager = new HandoffManager();
      checkpoint=await attachSessionCheckpoint(manager,dir);
      bridge = new LocalBridge(manager);
      manager.once('uninstall',()=>{manager.stopActive();app.quit();});
      await bridge.start();
      await writeDesktopManifest(dir,{port:bridge.port,desktopToken:bridge.token,pid:process.pid});
      await writeManifest(dir, { port:bridge.port, token:bridge.agentToken, pid:process.pid, startedAt:Date.now(), protocol:1 });
      process.env.HANDOFFGLASS_PORT = String(bridge.port);
      process.env.HANDOFFGLASS_SECRET = bridge.token;
      ready = true;
    } catch (error) {
      showStartupError(error);
      app.quit();
    } finally {
      if (acquired) await rm(lock,{recursive:true,force:true});
    }
    if (ready) {
      app.on('before-quit', () => {
        if (exiting) return;
        exiting = true;
        manager.close();
        void checkpoint.close().then(()=>bridge.stop()).finally(async () => {
          try {
            const live = await readManifest(dir);
            if (live?.pid === process.pid && live.token === bridge.agentToken) {await rm(join(dir,'broker.json'),{force:true});await rm(join(dir,'desktop.json'),{force:true});}
          } catch (error) { console.error('Cleanup:',error.message); }
        });
      });
      await import('./main.mjs');
      const {hasUserPreferences}=await import('../local/preferences.mjs');
      if(await hasUserPreferences()){const {showControlCenter}=await import('./center.mjs');await showControlCenter();}
    }
  }).catch(error => {
    showStartupError(error);
    app.exit(1);
  });
}
