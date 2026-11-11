import {app} from 'electron';
import {join} from 'node:path';

// Source launches and installed builds share one desktop identity. Tests keep
// their explicitly assigned profile by importing main only after app.ready.
app.setName('HandoffGlass');
if(!app.isReady())app.setPath('userData',process.env.HANDOFFGLASS_RUNTIME_DIR
  ?join(process.env.HANDOFFGLASS_RUNTIME_DIR,'desktop-profile')
  :join(app.getPath('appData'),'HandoffGlass'));
export const desktopOwner=app.requestSingleInstanceLock();
if(!desktopOwner)app.quit();
else app.on('second-instance',()=>void import('./center.mjs').then(m=>m.showControlCenter()));
