import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { validDisplay, canLocateAll } from './geometry.mjs';
import { loadPreferences, hasUserPreferences, savePreferences, validatePreferences } from './local/preferences.mjs';
import { compileBlueprint, BLUEPRINT_NAMES } from './local/blueprints.mjs';
import { locateNative, inspectNative, validateTarget, nativePermissionStatus, closeNativeWorkers } from './native/locator.mjs';
import { GroundingError } from './visual/grounding.mjs';
import { HostActivity } from './local/host-activity.mjs';
import { layoutSignature, compareObservation } from './native/calibration.mjs';
import { NativeAnchorTracker } from './native/anchor-tracker.mjs';
import { InteractionJournal, recoveryFor } from './local/interaction-journal.mjs';
import { getAccessibilityConsent, setAccessibilityConsent } from './native/preferences.mjs';
import { TargetRegistry } from './visual/target-registry.mjs';
import { CAPABILITY_MANIFEST } from './capabilities.mjs';
import { quickMarkRequest, drawingScene } from './visual/quick-mark.mjs';
import { continuationFor } from './output.mjs';
import { TERMINAL_STATES } from './core.mjs';
import { startDesktopTrial } from './local/desktop-trial.mjs';
import { integrationStatus, cleanupIntegration, lifecycleGuide, setIntegrationEnabled, uninstallApplication } from './integration-lifecycle.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function sendJson(res, code, data) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  });
  res.end(JSON.stringify(data));
}
function readJson(req, byteLimit = 16384) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const buffers = [];
    let failed = false;
    req.on('data', chunk => {
      if (failed) return;
      size += chunk.length;
      if (size > byteLimit) {
        failed = true;
        reject(Object.assign(new Error('Payload too large'), { httpCode: 413 }));
        req.resume();
      } else buffers.push(chunk);
    });
    req.on('end', () => {
      if (failed) return;
      try { resolve(JSON.parse(Buffer.concat(buffers).toString('utf8') || '{}')); }
      catch { reject(Object.assign(new Error('Invalid JSON'), { httpCode: 400 })); }
    });
    req.on('error', reject);
  });
}

/**
 * A loopback-only, secret-protected, versioned snapshot bridge.
 * No queued stale events: reconnecting UIs always receive the current state.
 */
export class LocalBridge {
  constructor(manager, { prepare = async () => {}, headless = false, locator = locateNative, inspector = inspectNative } = {}) {
    this.manager = manager;
    this.prepare = prepare;
    this.headless = headless;
    this.locator = locator;
    this.inspector = inspector;
    this.token = randomBytes(32).toString('hex'); // Desktop-only capability.
    this.agentToken = randomBytes(32).toString('hex'); // MCP client capability.
    this.server = null;
    this.port = null;
    this.lastPoll = 0;
    this.lastAgentRequestAt = null;
    this.hostActivity = new HostActivity();
    this.journal = new InteractionJournal(manager);
    this.displays = [];
    this.drawings=new Map();this.pluginBindings=new Map();this.targets=new TargetRegistry();this.agentWaits=new Map();this.connectionEvidence=new Map();this.permissionCache=null;
    this.resolvedTargets = new Map(); // owner/requestId -> original and grounded payload for safe retry
    this.revision = 0;
    this.waiters = new Set();
    this.streams=new Set();
    this.anchors = new NativeAnchorTracker({manager,locator:(target, displays)=>this.locator(target,displays),
      getDisplays:()=>this.displays,desktopReady:()=>this.headless || this.connected});
    this.onManagerChange = () => this.#publish();
    manager.on('show', this.onManagerChange);
    manager.on('change', this.onManagerChange);
  }
  get connected() { return this.streams.size > 0 || Date.now() - this.lastPoll < 35000; }
  snapshot() { const active=this.manager.active(),wait=active&&this.agentWaits.get(active.id);return { revision: this.revision, active, agentWaiting:!!wait?.count, agentWaitUntil:wait?.until||null }; }
  async permissions(){
    if(!this.permissionCache || Date.now()-this.permissionCache.at>10000){
      this.permissionCache={at:Date.now(),promise:nativePermissionStatus()};
    }
    return this.permissionCache.promise;
  }
  #publish() {
    this.revision++;
    if(this.publishQueued)return;
    this.publishQueued=true;
    queueMicrotask(()=>{
      this.publishQueued=false;const snapshot=this.snapshot();
      for(const stream of this.streams)stream.write(snapshot);
      for(const responder of [...this.waiters])responder(snapshot);
    });
  }
  async start() {
    if (this.server) return this.port;
    this.server = http.createServer((req, res) => {
      void this.#handle(req, res).catch(error => {
        sendJson(res, error.httpCode || 400, { error: error.message,
          ...(error instanceof GroundingError ? { code: error.code } : {}) });
      });
    });
    try {
      await new Promise((resolve, reject) => {
        this.server.once('error', reject);
        this.server.listen(0, '127.0.0.1', resolve);
      });
      this.port = this.server.address().port;
      return this.port;
    } catch (error) { this.server = null; throw error; }
  }
  async stop() {
    this.trial?.dispose();
    for(const stream of this.streams)stream.close();
    this.streams.clear();
    this.anchors.close();this.targets.clear();closeNativeWorkers();
    this.journal.close();
    for (const respond of [...this.waiters]) respond(this.snapshot());
    if (this.server) {
      await new Promise(resolve => this.server.close(resolve));
      this.server = null;
    }
    this.manager.off('show', this.onManagerChange);
    this.manager.off('change', this.onManagerChange);
  }
  /** Drawings use the existing scene engine, never a task wait or another Broker. */
  async mark(body,owner){
    const started=performance.now(),action=body.action??'draw';
    const error=(status,code,extra={})=>({status,body:{error:code,code,...extra}});
    if(!['draw','update','clear'].includes(action))return error(400,'invalid_action');
    const preference=await loadPreferences();
    if(!preference.enabled)return error(423,'disabled_by_user');
    const record=body.id&&this.drawings.get(body.id);
    if(action!=='draw'){
      const owned=record&&this.manager.getOwned(body.id,owner);
      if(!owned)return error(404,'not_found');
      if(TERMINAL_STATES.includes(owned.status))return error(409,'already_final');
      if(!Number.isInteger(body.expectedRevision)||body.expectedRevision!==owned.sceneRevision)return error(409,'revision_conflict',{revision:owned.sceneRevision});
      if(action==='clear'){
        const result=this.manager.resolve(body.id,'cancelled',owner);
        if(result.error)return error(409,result.error);
        this.drawings.delete(body.id);
        return {status:200,body:{id:body.id,revision:owned.sceneRevision,visible:false,nextAction:'done',localMs:+(performance.now()-started).toFixed(1)}};
      }
      if(!this.headless&&!this.connected)return error(503,'no_desktop');
      const {action:ignoredAction,id:ignoredId,expectedRevision:ignoredRevision,...patch}=body;
      const input={...record.input,...patch};delete input.requestId;
      const compiled=quickMarkRequest(input,this.displays,preference);
      const result=this.manager.updateScene(body.id,owner,body.expectedRevision,[{op:'upsert_layer',layer:drawingScene(compiled).layers[0]}],{visualStyle:compiled.visualStyle,motion:compiled.motion});
      if(result.error)return error(409,result.error);
      record.input=input;
      return {status:200,body:this.markResult(result.session,started)};
    }
    if(body.id!==undefined||body.expectedRevision!==undefined)return error(400,'draw_does_not_take_id');
    // Reject malformed input before starting Electron. Live bounds determine the final placement.
    quickMarkRequest(body,[{id:body.displayId||'validate',x:0,y:0,width:2000,height:1200}],preference,{validateOnly:true});
    await this.prepare();
    if(!this.headless&&!this.connected)return error(503,'no_desktop');
    if(!(await loadPreferences()).enabled)return error(423,'disabled_by_user');
    if(this.manager.active()?.continuous)return error(409,'busy');
    const compiled=quickMarkRequest(body,this.displays,preference);
    const {annotations,...request}=compiled;
    const session=this.manager.show({...request,scene:drawingScene(compiled)},owner);
    if(session.error)return error(409,session.error);
    if(TERMINAL_STATES.includes(session.status))return error(409,'already_final');
    if(!this.drawings.has(session.id))this.drawings.set(session.id,{input:structuredClone(body)});
    while(this.drawings.size>64)this.drawings.delete(this.drawings.keys().next().value);
    return {status:200,body:this.markResult(session,started)};
  }
  markResult(session,started){return {id:session.id,revision:session.sceneRevision,count:session.annotations.length,visible:!this.headless,expiresAt:session.timeoutAt,nextAction:'done',localMs:+(performance.now()-started).toFixed(1)};}
  async #handle(req, res) {
    // Authorization header cannot be supplied by ordinary cross-origin browser
    // fetch without a CORS preflight, and we do not enable CORS.
    const host = req.headers.host;
    if (host !== `127.0.0.1:${this.port}` || req.headers.origin) {
      return sendJson(res, 403, { error: 'Forbidden host or browser origin' });
    }
    const parsed = new URL(req.url, `http://${host}`);
    const pathname = parsed.pathname;
    // Do not allow a read-only route to be reached by a mutating method (or vice versa).
    const routes = { '/desktop/diagnostics': 'GET', '/hello': 'POST', '/health': 'GET', '/state': 'GET', '/poll': 'GET', '/decision': 'POST',
      '/desktop/mark':'POST', '/agent/mark':'POST', '/desktop/preferences':'POST', '/desktop/stream':'GET', '/desktop/control':'POST', '/desktop/permissions':'GET', '/desktop/trial':'POST', '/desktop/shutdown':'POST',
      '/agent/displays': 'GET', '/agent/inspect': 'GET', '/agent/show': 'POST', '/agent/status': 'GET',
      '/agent/wait': 'GET', '/agent/events': 'GET', '/agent/cancel': 'POST', '/agent/context': 'GET', '/agent/capabilities': 'GET',
      '/agent/connection': 'GET', '/agent/permissions': 'GET', '/agent/integration-status': 'GET', '/agent/integration-cleanup': 'POST', '/agent/integration-enabled':'POST',
      '/agent/plugin-hook':'POST', '/agent/integration-uninstall':'POST', '/agent/resume':'POST','/agent/control':'POST','/agent/verify': 'POST', '/agent/blueprint': 'POST', '/agent/scene': 'POST', '/agent/locate': 'POST' };
    if (Object.hasOwn(routes, pathname) && routes[pathname] !== req.method) {
      return sendJson(res, 405, { error: 'Method not allowed' });
    }
    const isAgentRoute = pathname.startsWith('/agent/') || pathname === '/health';
    const expected = Buffer.from(`Bearer ${isAgentRoute ? this.agentToken : this.token}`);
    const provided = Buffer.from(req.headers.authorization || '');
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }
    if (req.method === 'POST' && !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
      return sendJson(res, 415, { error: 'application/json is required' });
    }
    if (req.method === 'POST' && pathname === '/hello') {
      const body = await readJson(req);
      if (!Array.isArray(body.displays) || body.displays.length > 16 || !body.displays.every(validDisplay)) {
        return sendJson(res, 400, { error: 'Invalid display metadata' });
      }
      const formerLayout = layoutSignature(this.displays);
      this.displays = body.displays.map(d => ({
        id: d.id, x: d.x, y: d.y, width: d.width,
        height: d.height, primary:d.primary===true, scaleFactor: Number.isFinite(d.scaleFactor) ? d.scaleFactor : 1,
        ...(d.physicalBounds ? { physicalBounds: d.physicalBounds } : {})
      }));
      this.lastPoll = Date.now();
      if (formerLayout !== layoutSignature(this.displays)) this.anchors.invalidate();
      return sendJson(res, 200, { ok: true, ...this.snapshot() });
    }
    if (req.method === 'GET' && pathname === '/health') {
      return sendJson(res, 200, { ok: true, pid: process.pid, protocol: 1 });
    }
    if (req.method === 'GET' && pathname === '/desktop/diagnostics') {
      const active = this.manager.active();
      return sendJson(res, 200, {
        schemaVersion: 1, broker: 'running', desktopConnected: this.connected,
        lastAgentActivityAt: this.lastAgentRequestAt,
        displays: this.displays.length, pendingPolls: this.waiters.size,
        handoff: active ? { step:active.step, totalSteps:active.totalSteps, status: active.status, mode: active.mode, execution:active.execution, phase: active.phase, nextAction: active.nextAction, timeoutAt: active.timeoutAt } : null,
        hostActivity: this.hostActivity.snapshot(),connectionEvidence:[...this.connectionEvidence.values()],
        timeline: this.journal.recent(12).map(({type,at,reason})=>({type,at,...(reason?{reason}:{})}))
      });
    }
    if(req.method==='POST' && pathname==='/desktop/shutdown'){await readJson(req);res.once('finish',()=>this.manager.emit('uninstall'));return sendJson(res,200,{ok:true});}
    if(req.method==='GET' && pathname==='/desktop/permissions')return sendJson(res,200,await this.permissions());
    if(req.method==='POST' && pathname==='/desktop/control'){
      const body=await readJson(req);const active=this.manager.active();
      if(!active || body.id!==active.id || (body.step!==undefined && body.step!==active.step))return sendJson(res,409,{error:'stale_step'});
      if(!['pause','resume','retry_target','text_fallback','park','attach'].includes(body.action))return sendJson(res,400,{error:'invalid_action'});
      const result=this.manager.control(body.id,null,body.action);
      if(!['progress','park','attach'].includes(body.action))this.anchors.clearFor(body.id);
      if(!result.error)await this.manager.flushCheckpoint?.();
      return sendJson(res,result.error?409:200,{...result,...this.snapshot()});
    }
    if(req.method==='POST' && pathname==='/desktop/mark'){
      const result=await this.mark(await readJson(req),'desktop-drawing');
      return sendJson(res,result.status,result.body);
    }
    if(req.method==='POST' && pathname==='/desktop/trial'){
      await readJson(req);
      const preferences=await loadPreferences();
      if(!preferences.enabled)return sendJson(res,423,{error:'disabled_by_user'});
      const active=this.manager.active();if(active)return sendJson(res,409,{error:'busy'});
      this.trial?.dispose();this.trial=startDesktopTrial(this.manager,preferences,this.displays);
      return sendJson(res,200,{session:this.trial.session});
    }
    if(req.method==='POST' && pathname==='/desktop/preferences'){
      const {accessibility,...patch}=await readJson(req);
      validatePreferences(patch);
      if(accessibility!==undefined&&typeof accessibility!=='boolean')return sendJson(res,400,{error:'Invalid accessibility choice'});
      // Desktop windows submit patches to the Broker, which also owns Agent enable/disable writes.
      const preferences=Object.keys(patch).length?await savePreferences(patch):await loadPreferences();
      if(accessibility!==undefined)await setAccessibilityConsent(accessibility);
      this.permissionCache=null;
      if(!preferences.enabled || !preferences.continuous){this.anchors.clear();this.manager.stopActive();}
      else if(accessibility===false){
        const active=this.manager.active();this.anchors.clear();
        if(active?.targetTracking)this.manager.setAnchorState(active.id,{status:'lost',annotations:[],reason:'consent_required'});
      }
      return sendJson(res,200,{ok:true,preferences,accessibility:await getAccessibilityConsent()});
    }
    if(req.method==='GET' && pathname==='/desktop/stream'){
      if(this.streams.size>=4)return sendJson(res,503,{error:'Too many desktop streams'});
      res.socket?.setNoDelay(true);
      res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','x-content-type-options':'nosniff'});
      const stream={write:state=>{
        if(res.destroyed||res.writableEnded)return;
        if(res.writableLength>262144){res.destroy();return;}
        res.write(`data: ${JSON.stringify(state)}\n\n`);
      },close:()=>res.end()};
      this.streams.add(stream);stream.write(this.snapshot());
      const heartbeat=setInterval(()=>{this.lastPoll=Date.now();res.write(': keepalive\n\n');},15000);
      res.on('close',()=>{clearInterval(heartbeat);this.streams.delete(stream);});
      return;
    }
    if (req.method === 'GET' && pathname === '/state') {
      return sendJson(res, 200, this.snapshot());
    }
    if (pathname.startsWith('/agent/')) {
      const owner = req.headers['x-handoffglass-owner'];
      if (typeof owner !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(owner)) {
        return sendJson(res, 403, { error: 'Agent identity is required', code: 'invalid_owner' });
      }
      this.lastAgentRequestAt = Date.now();
      const connectionId=req.headers['x-handoffglass-connection'];
      res.once('finish',()=>{
        if(res.statusCode>=200 && res.statusCode<300 && ['/agent/displays','/agent/inspect','/agent/locate','/agent/connection'].includes(pathname)){
          this.hostActivity.record(req.headers['x-handoffglass-host'],pathname);
          if(typeof connectionId==='string' && /^[0-9a-f-]{36}$/.test(connectionId)){
            this.connectionEvidence.set(connectionId,{id:connectionId,connectionId,host:String(req.headers['x-handoffglass-host']||'unidentified').slice(0,32),lastSuccessAt:Date.now(),lastTool:pathname.slice(7)});
            while(this.connectionEvidence.size>32)this.connectionEvidence.delete(this.connectionEvidence.keys().next().value);
          }
        }
      });
      const isDisabled = async () => (await loadPreferences()).enabled === false;
      if(req.method==='POST' && pathname==='/agent/plugin-hook') {
        const body=await readJson(req);
        if(!/^[a-f0-9]{64}$/.test(body.hostSession||'') || !['bind','status','progress','interrupt','end'].includes(body.event))
          return sendJson(res,400,{code:'invalid_hook',error:'Invalid hook envelope'});
        if(body.event==='status' && await isDisabled())return sendJson(res,423,{code:'disabled_by_user',error:'Guidance disabled'});
        const s=this.manager.getByResumeToken(body.sessionId,body.resumeToken);
        if(!s)return sendJson(res,404,{code:'not_found',error:'Session binding unavailable'});
        const existing=this.pluginBindings.get(s.id);
        if(existing && existing.hostSession!==body.hostSession && !(body.event==='bind' && existing.proof!==body.resumeToken))return sendJson(res,409,{code:'binding_conflict',error:'Session belongs to another host chat'});
        if(body.event==='bind') {
          this.pluginBindings.set(s.id,{hostSession:body.hostSession,proof:body.resumeToken});
          while(this.pluginBindings.size>64)this.pluginBindings.delete(this.pluginBindings.keys().next().value);
        } else if(!existing)return sendJson(res,409,{code:'binding_required',error:'Bind this host chat first'});
        const stopped=['completed','declined','cancelled','expired','superseded'].includes(s.status);
        const stepMatches=Number.isInteger(body.expectedStep)&&body.expectedStep===s.step;
        if(!stopped && body.event!=='status' && body.event!=='bind') {
          if(!stepMatches)return sendJson(res,409,{code:'stale_step',error:'Hook belongs to an earlier step'});
          if(body.event==='end'){if(s.execution!=='parked')this.manager.resolve(s.id,'cancelled');this.pluginBindings.delete(s.id);}
          else if(body.event==='interrupt')this.manager.control(s.id,null,'pause');
          else if(body.event==='progress') {
            if(await isDisabled())return sendJson(res,423,{code:'disabled_by_user',error:'Guidance disabled'});
            if(s.status!=='paused' && s.execution!=='parked')this.manager.control(s.id,null,'progress',body.phase);
          }
        }
        const current=this.manager.get(s.id),{id,status,phase,nextAction,step,verified,execution}=current;
        return sendJson(res,200,{session:{id,status,phase,nextAction,step,verified,execution}});
      }
      if (req.method === 'GET' && pathname === '/agent/displays') {
        if(await isDisabled())return sendJson(res,423,{error:'HandoffGlass is disabled by the user',code:'disabled_by_user'});
        await this.prepare();
        return sendJson(res, 200, { displays: this.displays, connected: this.connected, headless: this.headless });
      }
      if (req.method === 'GET' && pathname === '/agent/inspect') {
        if (await isDisabled()) return sendJson(res, 423, { error: 'HandoffGlass is disabled by the user', code: 'disabled_by_user' });
        await this.prepare();
        if (!this.headless && !this.connected) return sendJson(res,503,{error:'Desktop unavailable',code:'no_desktop'});
        const inspected=await this.inspector(this.displays),signature=layoutSignature(this.displays);
        for(const control of inspected.controls||[])if(control.targetable)control.targetRef=this.targets.add(owner,validateTarget(control),signature);
        return sendJson(res,200,inspected);
      }
      if (req.method === 'GET' && pathname === '/agent/context') {
        const preferences = await loadPreferences();
        return sendJson(res, 200, { preferences, storage: 'local', historyStored: false, modelCallRequired: false });
      }
      if (req.method === 'GET' && pathname === '/agent/capabilities') {
        const preferences=await loadPreferences();
        return sendJson(res, 200, { manifest: CAPABILITY_MANIFEST, runtime:{enabled:preferences.enabled,continuous:preferences.continuous,desktop:this.headless?'headless':this.connected?'ready':'offline',permissions:await this.permissions(),host:{id:req.headers['x-handoffglass-host']||'unidentified',events:'unknown',parallelCalls:'unknown',structuredResults:true},recovery:'session_resume with saved resumeToken; observe before presenting'} });
      }
      if (req.method === 'GET' && pathname === '/agent/connection') {
        const preferences = await loadPreferences();
        return sendJson(res, 200, { broker: 'running', desktop: this.connected || this.headless ? 'ready' : 'offline', enabled: preferences.enabled, continuous: preferences.continuous, host: req.headers['x-handoffglass-host'] || 'unidentified' });
      }
      if (req.method === 'GET' && pathname === '/agent/permissions') {
        const preferences = await loadPreferences();
        return sendJson(res, 200, { enabled: preferences.enabled, continuous: preferences.continuous, ...await this.permissions() });
      }
      if (req.method === 'POST' && pathname === '/agent/integration-enabled') {
        const body=await readJson(req);
        const result=await setIntegrationEnabled(body.enabled);
        if(!result.enabled){this.anchors.clear();this.manager.stopActive();}
        return sendJson(res,200,result);
      }
      if (req.method === 'GET' && pathname === '/agent/integration-status') {
        const host = parsed.searchParams.get('host') || 'codex';
        try { return sendJson(res, 200, { status: await integrationStatus(host, { root: PROJECT_ROOT }), guide: lifecycleGuide(host) }); }
        catch (error) { return sendJson(res, 400, { error: error.message, code: 'unsupported_integration' }); }
      }
      if(req.method==='POST' && pathname==='/agent/integration-uninstall'){
        const body=await readJson(req);if(typeof body.confirm!=='boolean')return sendJson(res,400,{error:'confirm must be boolean'});
        const result=await uninstallApplication({confirm:body.confirm,root:PROJECT_ROOT});
        if(result.scheduled)res.once('finish',()=>this.manager.emit('uninstall'));
        return sendJson(res,200,{result});
      }
      if (req.method === 'POST' && pathname === '/agent/integration-cleanup') {
        const body = await readJson(req);
        if (typeof body.host !== 'string' || typeof body.confirm !== 'boolean') return sendJson(res, 400, { error: 'host and confirm are required' });
        try { return sendJson(res, 200, { result: await cleanupIntegration(body.host, { confirm: body.confirm, root: PROJECT_ROOT }) }); }
        catch (error) { return sendJson(res, 400, { error: error.message, code: 'cleanup_refused' }); }
      }
      if (req.method === 'POST' && pathname === '/agent/blueprint') {
        const { blueprint, locale } = await readJson(req);
        if (!BLUEPRINT_NAMES.includes(blueprint)) return sendJson(res, 400, { error: 'Unknown blueprint' });
        const preferences = await loadPreferences();
        return sendJson(res, 200, compileBlueprint(blueprint, { locale: locale || preferences.locale }));
      }
      if (req.method === 'POST' && pathname === '/agent/locate') {
        if (await isDisabled()) return sendJson(res, 423, { error: 'HandoffGlass is disabled by the user', code: 'disabled_by_user' });
        const body = await readJson(req);
        const target = validateTarget(body.target);
        await this.prepare();
        if (!this.headless && !this.connected) return sendJson(res, 503, { error: 'Desktop unavailable', code: 'no_desktop' });
        const located = await this.locator(target, this.displays);
        // Only compare against a caller-provided previous observation; never
        // mistake a locally observed position for proof the user clicked it.
        const signature = layoutSignature(this.displays);
        const previous = body.previous;
        const comparison = previous === undefined ? null : compareObservation(previous, located, signature);
        const groundedQuery=validateTarget({...target,...(located.nativeRef?{nativeRef:located.nativeRef,scope:located.scope}:{})});
        return sendJson(res, 200, { targetRef:this.targets.add(owner,groundedQuery,signature),target: {...located, layoutSignature:signature},
          ...(comparison ? { comparison } : {}), coordinateSystem: 'global_DIP',
          warning: 'This is an observation, not permission to click or approve. Revalidate after UI changes.' });
      }
      if(req.method==='POST' && pathname==='/agent/mark') {
        const result=await this.mark(await readJson(req),owner);
        return sendJson(res,result.status,result.body);
      }
      if (req.method === 'POST' && pathname === '/agent/show') {
        const body = await readJson(req);
        const preference = await loadPreferences();
        if (!preference.enabled) return sendJson(res,423,{error:'HandoffGlass is disabled by the user',code:'disabled_by_user'});
        if(body.continuous && !preference.continuous)return sendJson(res,423,{error:'Continuous sessions are disabled by the user',code:'continuous_disabled'});
        if(body.sessionId && !this.manager.getOwned(body.sessionId,owner))return sendJson(res,404,{error:'Session not found',code:'not_found'});
        const original = JSON.stringify(body);
        const hadTarget = body.target !== undefined || body.targetRef !== undefined;
        const followTarget = body.followTarget !== false;
        if (!hadTarget && body.followTarget !== undefined) return sendJson(res,400,{error:'followTarget requires a native target',code:'invalid_follow'});
        if (body.followTarget !== undefined && typeof body.followTarget !== 'boolean') return sendJson(res,400,{error:'followTarget must be boolean',code:'invalid_follow'});
        delete body.followTarget;
        let anchoredQuery=null, anchoredHit=null;
        const retryKey = typeof body.requestId === 'string' ? JSON.stringify([owner,body.requestId]) : null;
        const previous = retryKey && this.resolvedTargets.get(retryKey);
        if (previous) {
          if (previous.original !== original) return sendJson(res, 400, {error:'requestId reused with different original target',code:'idempotency_conflict'});
          Object.assign(body, structuredClone(previous.resolved));
          delete body.target;delete body.targetRef;
        }
        if(body.targetRef!==undefined){
          if(body.target!==undefined)return sendJson(res,400,{error:'Choose targetRef or target',code:'invalid_target'});
          body.target=this.targets.get(body.targetRef,owner,layoutSignature(this.displays));delete body.targetRef;
        }
        if (body.target !== undefined) {
          const target = validateTarget(body.target);
          const active = this.manager.active();
          if (active && this.manager.owners.get(active.id) !== owner)
            return sendJson(res,409,{error:'Another Agent owns the active handoff',code:'busy'});
          if (body.x !== undefined || body.y !== undefined || body.annotations !== undefined ||
              body.scene !== undefined) return sendJson(res, 400, { error: 'Choose target or coordinates/scene', code: 'invalid_target' });
          await this.prepare();
          if (!this.headless && !this.connected) return sendJson(res, 503, { error: 'Desktop unavailable', code: 'no_desktop' });
          const hit = await this.locator(target, this.displays);
          anchoredQuery=validateTarget({...target,...(hit.nativeRef?{nativeRef:hit.nativeRef,scope:hit.scope}:{})});anchoredHit=hit;
          delete body.target;
          body.x = hit.x; body.y = hit.y; body.width = hit.width; body.height = hit.height;
          if(body.intent && !body.shape && !body.template)body.template=body.intent;
        }
        // Apply user-owned visual preferences; Agents cannot persist them.
        body.locale = preference.locale;
        body.density = preference.density;
        body.theme = preference.theme;
        if (await hasUserPreferences()) {
          // Persistent, explicitly user-chosen preferences outrank the Agent's cosmetic hints.
          body.visualStyle = preference.visualStyle;
          body.motion = preference.motion;
        } else {
          if (body.visualStyle === undefined) body.visualStyle = preference.visualStyle;
          if (body.motion === undefined) body.motion = preference.motion;
        }
        // Validate BEFORE starting Electron, to avoid spawning a desktop for bad requests.
        const { normalizeRequest } = await import('./core.mjs');
        const normalized = normalizeRequest(body);
        await this.prepare();
        if (!this.headless && !this.connected) {
          return sendJson(res, 503, { error: 'Desktop overlay unavailable', code: 'no_desktop' });
        }
        if (!this.headless && !canLocateAll(this.displays, normalized.annotations)) {
          return sendJson(res, 422, { error: 'Target outside current display bounds; call screen_displays', code: 'outside_display' });
        }
        // A user may pause guidance while a native lookup or desktop startup is
        // in flight. Recheck before the synchronous session mutation.
        const latestPreferences=await loadPreferences();
        if(!latestPreferences.enabled)return sendJson(res,423,{error:'HandoffGlass is disabled by the user',code:'disabled_by_user'});
        if(body.continuous && !latestPreferences.continuous)return sendJson(res,423,{error:'Continuous sessions are disabled by the user',code:'continuous_disabled'});
        const priorStep=body.sessionId?this.manager.getOwned(body.sessionId,owner)?.step:null;
        const result=body.sessionId?this.manager.present(body.sessionId,body,owner):{session:this.manager.show(body,owner)};
        if(result.error)return sendJson(res,409,{error:result.error,code:result.error});
        const session=result.session;
        if (session.error) return sendJson(res, 409, { error: 'A different Agent already owns the active handoff', code: 'busy' });
        if(body.sessionId && session.step!==priorStep)this.anchors.clearFor(body.sessionId);
        if (anchoredQuery && followTarget) this.anchors.track(session.id,anchoredQuery,anchoredHit);
        if (retryKey && !previous && hadTarget) {
          this.resolvedTargets.set(retryKey,{original,resolved:structuredClone(body)});
          if(this.resolvedTargets.size > 128) this.resolvedTargets.delete(this.resolvedTargets.keys().next().value);
        }
        const resumeToken=session.continuous?this.manager.issueResume(session.id,owner):undefined;
        await this.manager.flushCheckpoint?.();
        return sendJson(res, 200, { session: this.manager.get(session.id), ...(resumeToken?{resumeToken}:{}), nextCursor:this.journal.latestCursor(session.id), visible: !this.headless,
          coordinateSystem: 'global_DIP',
          instruction: 'User-reported completion is not verification. Recheck the target application.' });
      }
      if (req.method === 'GET' && pathname === '/agent/status') {
        const id = parsed.searchParams.get('sessionId');
        return sendJson(res, 200, { session: this.manager.getOwned(id, owner), connected: this.connected });
      }
      if (req.method === 'GET' && pathname === '/agent/events') {
        const id = parsed.searchParams.get('sessionId');
        if (!id || !this.manager.getOwned(id, owner)) return sendJson(res, 404, {error:'Session not found',code:'not_found'});
        const after = Number(parsed.searchParams.get('after') ?? 0);
        const limit = Number(parsed.searchParams.get('limit') ?? 20);
        if (!Number.isSafeInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > 32)
          return sendJson(res,400,{error:'Invalid event cursor',code:'invalid_cursor'});
        const events = this.journal.read(id,{after,limit});
        return sendJson(res,200,{...events,recovery:recoveryFor(this.manager.getOwned(id,owner)),
          note:'Events are local observations, not proof of downstream task success.'});
      }
      if (req.method === 'GET' && pathname === '/agent/wait') {
        const id = parsed.searchParams.get('sessionId');
        const ms = Number(parsed.searchParams.get('maxWaitMs') ?? 15000);
        if (!Number.isFinite(ms) || ms < 0 || ms > 30000) {
          return sendJson(res, 400, { error: 'Invalid wait timeout' });
        }
        const preferences = await loadPreferences();
        if (parsed.searchParams.get('continuous') === '1' && preferences.continuous === false)
          return sendJson(res, 423, { error: 'Continuous sessions are disabled by the user', code: 'continuous_disabled' });
        if(parsed.searchParams.get('continuous')==='1'){
          if(!preferences.enabled)return sendJson(res,423,{error:'HandoffGlass is disabled by the user',code:'disabled_by_user'});
          if(!this.manager.getOwned(id,owner))return sendJson(res,404,{error:'Session not found',code:'not_found'});
          const cursor=Number(parsed.searchParams.get('cursor')??0);
          if(!Number.isSafeInteger(cursor)||cursor<0)return sendJson(res,400,{error:'Invalid cursor',code:'invalid_cursor'});
          const parked=this.manager.getOwned(id,owner);
          if(TERMINAL_STATES.includes(parked.status))return sendJson(res,200,{...this.journal.read(id,{after:cursor}),session:parked,pending:false,nextAction:continuationFor(parked)});
          if(parked.execution==='parked')return sendJson(res,200,{...this.journal.read(id,{after:cursor}),session:parked,pending:true,nextAction:'yield_to_user',delivery:{mode:'parked',resume:'session_control attach; inspect before verification'}});
          const abort=new AbortController(),onClose=()=>abort.abort();res.on('close',onClose);
          const priorWait=this.agentWaits.get(id);this.agentWaits.set(id,{count:(priorWait?.count||0)+1,until:Math.max(priorWait?.until||0,Date.now()+ms)});this.#publish();
          try{
            const events=await this.journal.wait(id,{after:cursor,timeoutMs:ms,signal:abort.signal});
            const session=this.manager.getOwned(id,owner);
            if(!session)return sendJson(res,404,{error:'not_found',code:'not_found'});
            return sendJson(res,200,{...events,session,pending:!events.events?.length,nextAction:continuationFor(session)});
          }finally{res.off('close',onClose);const wait=this.agentWaits.get(id);if(wait?.count>1)wait.count--;else this.agentWaits.delete(id);this.#publish();}
        }
        return sendJson(res, 200, await this.manager.waitOwned(id, owner, ms));
      }
      if(req.method==='POST' && pathname==='/agent/resume'){
        if(await isDisabled())return sendJson(res,423,{error:'disabled_by_user',code:'disabled_by_user'});
        const body=await readJson(req);if(typeof body.sessionId!=='string'||typeof body.resumeToken!=='string'||body.resumeToken.length!==64)return sendJson(res,400,{error:'invalid_resume_token',code:'invalid_resume_token'});
        const result=this.manager.resume(body.sessionId,body.resumeToken,owner);
        if(!result.error)await this.manager.flushCheckpoint?.();
        return sendJson(res,result.error?409:200,{...result,...(result.error?{code:result.error}:{nextCursor:this.journal.latestCursor(body.sessionId)})});
      }
      if(req.method==='POST' && pathname==='/agent/control'){
        if(await isDisabled())return sendJson(res,423,{error:'disabled_by_user',code:'disabled_by_user'});
        const body=await readJson(req);const session=this.manager.getOwned(body.sessionId,owner);
        if(!session)return sendJson(res,404,{error:'not_found',code:'not_found'});
        if(body.expectedStep!==undefined&&body.expectedStep!==session.step)return sendJson(res,409,{error:'stale_step',code:'stale_step'});
        const result=this.manager.control(body.sessionId,owner,body.action,body.phase);
        if(!result.error && !['progress','park','attach'].includes(body.action))this.anchors.clearFor(body.sessionId);
        return sendJson(res,result.error?409:200,{...result,...(result.error?{code:result.error}:{})});
      }
      if (req.method === 'POST' && pathname === '/agent/verify') {
        const body = await readJson(req);
        if (typeof body.sessionId !== 'string' || typeof body.verified !== 'boolean' || (body.finish!==undefined && typeof body.finish!=='boolean')) return sendJson(res, 400, { error: 'sessionId and verified are required' });
        const current=this.manager.getOwned(body.sessionId,owner);
        if(body.expectedStep!==undefined&&body.expectedStep!==current?.step)return sendJson(res,409,{error:'stale_step',code:'stale_step'});
        const result = this.manager.verify(body.sessionId, owner, body.verified, body.finish === true);
        return sendJson(res, result.error ? 409 : 200, result);
      }
      if (req.method === 'POST' && pathname === '/agent/scene') {
        if (await isDisabled()) return sendJson(res, 423, { error: 'HandoffGlass is disabled by the user', code: 'disabled_by_user' });
        const body = await readJson(req);
        if (typeof body.sessionId !== 'string') return sendJson(res, 400, { error: 'Invalid session id' });
        // Run full schema validation and out-of-bounds guard BEFORE mutating state.
        const owned = this.manager.getOwned(body.sessionId, owner);
        if (!owned) return sendJson(res, 404, { error: 'Session not found' });
        if (!owned.scene) return sendJson(res, 409, { error: 'Session has no mutable scene', code: 'scene_not_enabled' });
        if (body.expectedRevision !== owned.sceneRevision) return sendJson(res, 409, { error: 'Scene revision conflict', code: 'revision_conflict', sceneRevision: owned.sceneRevision });
        const { patchScene, flattenScene } = await import('./visual/scene.mjs');
        const preview = patchScene(owned.scene, body.operations);
        // An accepted edit must correspond to an available desktop, not just in-memory state.
        await this.prepare();
        if (!this.headless && !this.connected) {
          return sendJson(res, 503, { error: 'Desktop overlay unavailable', code: 'no_desktop' });
        }
        if (!this.headless && !canLocateAll(this.displays, flattenScene(preview))) {
          return sendJson(res, 422, { error: 'Scene target outside display', code: 'outside_display' });
        }
        // Do not resurrect stale native coordinates through a scene edit while
        // the target is missing or the desktop/display layout is changing.
        if (owned.targetTracking && ['lost','layout_changed','desktop_unavailable'].includes(owned.targetTracking.status))
          return sendJson(res,409,{error:'Native target currently unverified',code:'target_unavailable'});
        const result = this.manager.updateScene(body.sessionId, owner, body.expectedRevision, body.operations);
        // Manual edits take ownership of the scene and stop automatic target following.
        if (!result.error) this.anchors.clearFor(body.sessionId);
        return sendJson(res, result.error ? 409 : 200, result);
      }
      if (req.method === 'POST' && pathname === '/agent/cancel') {
        const body = await readJson(req);
        if (typeof body.sessionId !== 'string') return sendJson(res, 400, { error: 'Invalid session ID' });
        const outcome = this.manager.resolve(body.sessionId, 'cancelled', owner);
        return sendJson(res, 200, outcome);
      }
      return sendJson(res, 404, { error: 'Unknown agent endpoint' });
    }
    if (req.method === 'GET' && pathname === '/poll') {
      this.lastPoll = Date.now();
      const raw = new URL(req.url, `http://${host}`).searchParams.get('after');
      const after = raw === null ? -1 : Number(raw);
      if (!Number.isSafeInteger(after) || after < -1) return sendJson(res, 400, { error: 'Invalid revision' });
      if (after !== this.revision) return sendJson(res, 200, this.snapshot());
      let timer;
      const respond = data => {
        clearTimeout(timer);
        this.waiters.delete(respond);
        sendJson(res, 200, data);
      };
      if (this.waiters.size >= 128) return sendJson(res, 503, { error: 'Too many pending polls' });
      this.waiters.add(respond);
      timer = setTimeout(() => respond(this.snapshot()), 10000);
      res.on('close', () => { clearTimeout(timer); this.waiters.delete(respond); });
      return;
    }
    if (req.method === 'POST' && pathname === '/decision') {
      const body = await readJson(req);
      if (typeof body.id !== 'string' || !['completed', 'declined', 'cancelled'].includes(body.status)) {
        return sendJson(res, 400, { error: 'Invalid decision' });
      }
      if(body.step!==undefined && body.step!==this.manager.get(body.id)?.step)return sendJson(res,409,{error:'stale_step'});
      const result = this.manager.resolve(body.id, body.status);
      if(!result.error)await this.manager.flushCheckpoint?.();
      return sendJson(res, result.error ? 409 : 200, {...result,...this.snapshot()});
    }
    return sendJson(res, 404, { error: 'Unknown endpoint' });
  }
}
