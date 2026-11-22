import {randomUUID} from 'node:crypto';
import {layoutSignature} from '../native/calibration.mjs';

export const MAX_SCREENSHOT_BYTES = 2_400_000;
export const APP_BUNDLE_ID = /^[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/i;
const screenshotErrors = new Map([
  ['capture_cancelled','Screenshot sharing was cancelled.'],
  ['capture_failed','HandoffGlass could not capture the requested application.'],
  ['capture_unsupported','Screenshot sharing requires macOS 14 or later.'],
  ['capture_target_not_visible','Open the requested application on the selected display before sharing a screenshot.'],
  ['screen_permission_required','Allow HandoffGlass in System Settings → Privacy & Security → Screen & System Audio Recording.'],
  ['layout_changed','The display layout changed during screenshot sharing.'],
  ['protected_application','Screen sharing is unavailable for this protected application.']
]);
const fail=(status,code,message=code)=>Object.assign(new Error(message),{httpCode:status,code});
export function validateScreenshotApp(appBundleId) {
  if(typeof appBundleId!=='string'||appBundleId.length>160||!APP_BUNDLE_ID.test(appBundleId))throw fail(400,'invalid_app');
  if(/^(com\.openai\.|com\.tencent\.workbuddy\.mac$|dev\.handoffglass\.desktop$)/i.test(appBundleId))
    throw fail(403,'protected_application',screenshotErrors.get('protected_application'));
}

export class ScreenshotShare {
  pending = null;

  request({appBundleId,displayId}, displays, send, signal) {
    if(displayId!==undefined&&!displays.some(d=>d.id===displayId))throw fail(400,'no_display');
    if(this.pending)throw fail(409,'capture_busy');
    if(signal.aborted)throw fail(499,'capture_cancelled');
    const request={captureId:randomUUID(),appBundleId,displayId,deadline:Date.now()+25000,layoutSignature:layoutSignature(displays)};
    return new Promise((resolve,reject)=>{
      const finish=(error,value)=>{
        this.pending=null;clearTimeout(timer);signal.removeEventListener('abort',abort);
        if(error)reject(error);else resolve(value);
      };
      const abort=()=>finish(fail(499,'capture_cancelled'));
      const timer=setTimeout(()=>finish(fail(408,'capture_timeout','The screenshot request expired.')),25000);
      this.pending={request,finish};
      signal.addEventListener('abort',abort,{once:true});
      try{send(request);}catch(error){finish(error);}
    });
  }

  approve(captureId) {
    const pending=this.pending;
    if(!pending||pending.request.captureId!==captureId||Date.now()>=pending.request.deadline)
      throw fail(404,'capture_not_pending');
    if(pending.approvedAt)throw fail(409,'capture_already_approved');
    pending.approvedAt=Date.now();
  }

  accept(body,displays) {
    const pending=this.pending;
    if(!pending||pending.request.captureId!==body?.captureId)throw fail(404,'capture_not_pending');
    const {request,finish}=pending;
    if(Date.now()>=request.deadline)return finish(fail(408,'capture_timeout'));
    if(screenshotErrors.has(body.error))return finish(fail(422,body.error,screenshotErrors.get(body.error)));
    if(!pending.approvedAt)throw fail(409,'capture_not_approved');
    const display=displays.find(d=>d.id===body.displayId);
    if(!display||layoutSignature(displays)!==request.layoutSignature||request.displayId&&request.displayId!==display.id||
      !['x','y','width','height'].every(key=>display[key]===body.bounds?.[key]))return finish(fail(409,'layout_changed'));
    const {data,width,height,capturedAt}=body;
    if(typeof data!=='string'||data.length>MAX_SCREENSHOT_BYTES||!data.startsWith('/9j/')||
      ![width,height].every(value=>Number.isInteger(value)&&value>0&&value<=1920)||
      !Number.isFinite(capturedAt)||capturedAt<pending.approvedAt||capturedAt>Date.now()+2000)
      return finish(fail(422,'invalid_screenshot'));
    const bounds=Object.fromEntries(['x','y','width','height'].map(key=>[key,display[key]]));
    finish(null,{data,appBundleId:request.appBundleId,displayId:display.id,
      frame:{width,height,capturedAt,bounds,layoutSignature:request.layoutSignature,provenance:'user'}});
  }

  cancel() {this.pending?.finish(fail(499,'capture_cancelled'));}
}
