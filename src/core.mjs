import { EventEmitter } from 'node:events';
import { randomUUID, randomBytes, createHash, timingSafeEqual } from 'node:crypto';

export const TERMINAL_STATES = Object.freeze(['completed', 'declined', 'cancelled', 'expired', 'superseded']);
const TERMINAL = new Set(TERMINAL_STATES);
import { VISUAL_STYLES, MOTION_MODES, LOCALES, THEMES } from './local/preferences.mjs';
import { SHAPES, normalizeAnnotation, normalizeScene, flattenScene, patchScene, composeTemplate, MAX_MARKS } from './visual/scene.mjs';
export { SHAPES, normalizeAnnotation } from './visual/scene.mjs';
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export function normalizeRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Request must be an object');
  const mode = input.mode ?? 'handoff';
  if(input.continuous!==undefined && typeof input.continuous!=='boolean')throw new TypeError('Invalid continuous flag');
  const locale = input.locale ?? 'zh-CN';
  const density = input.density ?? 'normal';
  const theme = input.theme ?? 'system';
  if (!THEMES.includes(theme)) throw new TypeError('Invalid UI theme');
  if (!LOCALES.includes(locale) || !['normal','compact'].includes(density)) throw new TypeError('Invalid display locale or density');
  const visualStyle = input.visualStyle ?? 'luminous';
  const motion = input.motion ?? 'gentle';
  if (!VISUAL_STYLES.includes(visualStyle) || !MOTION_MODES.includes(motion)) throw new TypeError('Invalid visual style or motion mode');
  const requestId = input.requestId === undefined ? null : input.requestId;
  if (requestId !== null && (typeof requestId !== 'string' || !/^[A-Za-z0-9_.:-]{8,96}$/.test(requestId))) {
    throw new TypeError('requestId must be 8–96 characters [A-Za-z0-9_.:-]');
  }
  if (mode !== 'guide' && mode !== 'handoff') throw new TypeError('Invalid presentation mode');
  const title = text(input.title, 100);
  const message = text(input.message, 1000);
  if (!title || !message) throw new TypeError('title and message are required');
  const timeoutSeconds = input.timeoutSeconds ?? (input.continuous ? 1800 : mode === 'guide' ? 90 : 300);
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 10 || timeoutSeconds > 3600) {
    throw new TypeError('timeoutSeconds must be an integer between 10 and 3600');
  }
  const taskTimeoutSeconds = input.taskTimeoutSeconds ?? 28800;
  if (!Number.isInteger(taskTimeoutSeconds) || taskTimeoutSeconds < 60 || taskTimeoutSeconds > 86400) throw new TypeError('Invalid task timeout');
  const completion = input.completion ?? {kind: mode === 'guide' ? 'observed_condition' : 'user_report'};
  if (!completion || !['user_report','observed_condition'].includes(completion.kind) || (completion.condition !== undefined && completion.condition !== 'target_absent')) throw new TypeError('Invalid completion condition');
  if (input.sensitive !== undefined && typeof input.sensitive !== 'boolean') throw new TypeError('Invalid sensitive flag');
  if (input.sensitive && completion.kind !== 'user_report') throw new TypeError('Sensitive steps require a user report');
  const intent = input.intent ?? 'focus';
  if (!['focus','point','inspect','caution','verify'].includes(intent)) throw new TypeError('Invalid intent');
  if (input.totalSteps !== undefined && (!Number.isInteger(input.totalSteps) || input.totalSteps < 1 || input.totalSteps > 999)) throw new TypeError('Invalid total steps');
  if (input.scrim !== undefined && typeof input.scrim !== 'boolean') throw new TypeError('Invalid scrim');
  if (input.scene !== undefined && (input.annotations !== undefined || input.x !== undefined || input.y !== undefined || input.template !== undefined)) {
    throw new TypeError('Choose scene, template/targets, or legacy annotations, not both');
  }
  if (input.template !== undefined && input.scene !== undefined) throw new TypeError('Choose scene or template');
  let scene = null;
  let annotations;
  if (input.scene !== undefined) {
    scene = normalizeScene(input.scene);
    annotations = flattenScene(scene);
  } else if (input.annotations !== undefined) {
    if (!Array.isArray(input.annotations) || input.annotations.length > 8) {
      throw new TypeError(`annotations must be an array of at most 8 items`);
    }
    annotations = input.annotations.map(normalizeAnnotation);
    if (input.x !== undefined || input.y !== undefined) throw new TypeError('Choose annotations or x/y shorthand, not both');
  } else if (input.x !== undefined || input.y !== undefined) {
    annotations = [normalizeAnnotation(input)];
  } else {
    annotations = [];
  }
  if (input.template !== undefined) {
    if (typeof input.template !== 'string') throw new TypeError('Invalid template');
    if (!annotations.length) throw new TypeError('Template requires grounded target coordinates');
    scene = composeTemplate(input.template, annotations);
    annotations = flattenScene(scene);
  }
  if (annotations.length > MAX_MARKS) throw new TypeError('Too many visible annotations');
  if (mode === 'guide' && annotations.length === 0) {
    throw new TypeError('Visual guidance requires grounded annotation coordinates');
  }
  return { taskTimeoutSeconds, completion:{...completion}, sensitive:input.sensitive===true, intent, scrim:input.scrim===true, ...(input.totalSteps?{totalSteps:input.totalSteps}:{}), continuous:input.continuous===true, mode, title, message, timeoutSeconds, annotations, requestId, visualStyle, motion, locale, density, theme, ...(scene ? { scene } : {}) };
}
function copySession(session) {
  if (!session) return null;
  return { ...session, completion:{...session.completion}, ...(session.agentState?{agentState:{...session.agentState}}:{}), ...(session.targetTracking?{targetTracking:{...session.targetTracking}}:{}), annotations: session.annotations.map(a => ({ ...a })),
    ...(session.scene ? { scene: normalizeScene(session.scene) } : {}) };
}

/**
 * In-memory single-active-session coordinator. The UI reports decisions, never
 * independently claims the downstream application performed the operation.
 * Listeners must not mutate session data; all emitted snapshots are copies.
 */
export class HandoffManager extends EventEmitter {
  constructor({ clock = () => Date.now(), maxHistory = 200 } = {}) {
    super();
    this.clock = clock;
    this.maxHistory = Math.max(2, Math.trunc(maxHistory));
    this.sessions = new Map();
    this.owners = new Map();
    this.timers = new Map();
    this.requestKeys = new Map(); // owner + requestId -> { id, normalized payload }
    this.pendingWaits = 0;
    this.setMaxListeners(96);
    this.activeId = null;
    this.resumeKeys = new Map();this.resumeTokens=new Map();
  }
  show(input, owner = 'local') {
    const normalized = normalizeRequest(input);
    if (typeof owner !== 'string' || !owner || owner.length > 128) throw new TypeError('Invalid owner');
    // Network/model retries with the same key must NOT replace an in-progress handoff.
    const key = normalized.requestId === null ? null : JSON.stringify([owner, normalized.requestId]);
    if (key && this.requestKeys.has(key)) {
      const record = this.requestKeys.get(key);
      if (record.payload !== JSON.stringify(normalized)) throw new TypeError('requestId was reused with different content');
      return this.get(record.id) ?? { error: 'request_expired' };
    }
    if(this.activeId)this.get(this.activeId);
    const previous = this.activeId && this.sessions.get(this.activeId);
    if (previous && this.owners.get(previous.id) !== owner) {
      return { error: 'busy', activeMode: previous.mode };
    }
    if (previous && !TERMINAL.has(previous.status)) this.#finish(previous, 'superseded');
    const now = this.clock();
    const session = {
      id: randomUUID(), mode: normalized.mode, title: normalized.title,
      message: normalized.message, annotations: normalized.annotations,
      visualStyle: normalized.visualStyle, motion: normalized.motion, locale:normalized.locale, density:normalized.density, theme:normalized.theme,
      ...(normalized.scene ? {scene:normalized.scene, sceneRevision:1} : {}),
      continuous: input.continuous === true, demo:owner==='desktop-trial', step: 1,
      completion:normalized.completion, sensitive:normalized.sensitive, intent:normalized.intent, scrim:normalized.scrim, totalSteps:normalized.totalSteps,
      taskTimeoutAt:now + (input.continuous ? normalized.taskTimeoutSeconds : normalized.timeoutSeconds) * 1000,
      stepTimeoutAt:now + normalized.timeoutSeconds * 1000,
      confirmationTimeoutAt:normalized.sensitive ? now + Math.min(300,normalized.timeoutSeconds)*1000 : null,
      agentState:{phase:'idle',at:now}, epoch:1,
      status: 'awaiting_user', phase: normalized.mode === 'guide' ? 'presenting' : 'waiting_user',
      nextAction: normalized.mode === 'guide' ? 'observe_app' : 'wait_for_user',
      createdAt: now, updatedAt: now,
      timeoutAt: now + normalized.timeoutSeconds * 1000,
      completionSource: null, verified: false
    };
    this.sessions.set(session.id, session);
    this.owners.set(session.id, owner);
    if (key) this.requestKeys.set(key, { id: session.id, payload: JSON.stringify(normalized) });
    this.activeId = session.id;
    this.#arm(session);
    this.#prune();
    this.emit('show', copySession(session));
    return copySession(session);
  }
  get(id) {
    const session = this.sessions.get(id);
    if (!session) return null;
    if (!TERMINAL.has(session.status) && this.clock() >= session.timeoutAt) this.#finish(session, 'expired');
    return copySession(session);
  }
  active() { return this.activeId ? this.get(this.activeId) : null; }
  getOwned(id, owner) { return this.owners.get(id) === owner ? this.get(id) : null; }
  async waitOwned(id, owner, timeoutMs = 15000) {
    if (this.owners.get(id) !== owner) return { error: 'not_found' };
    return this.wait(id, timeoutMs);
  }
  resolve(id, status, owner = null) {
    if (!['completed', 'declined', 'cancelled'].includes(status)) throw new TypeError('Invalid decision');
    const session = this.sessions.get(id);
    if (!session || (owner !== null && this.owners.get(id) !== owner)) return { error: 'not_found' };
    this.get(id); // expiry always wins over a late response
    if (TERMINAL.has(session.status)) return { error: 'already_final', session: copySession(session) };
    if (this.activeId !== id) return { error: 'not_active' };
    if(session.status==='paused' && status==='completed')return {error:'paused'};
    if(status==='completed' && session.continuous){
      if(session.status!=='awaiting_user')return {error:'verification_due',session:copySession(session)};
      session.status='user_action_reported';session.phase='verifying';session.nextAction='verify_in_app';
      session.completionSource='user_report';session.updatedAt=this.clock();session.annotations=[];
      session.stepTimeoutAt=this.clock()+1800000;session.confirmationTimeoutAt=null;this.#arm(session);
      this.emit('change',copySession(session));
    }else this.#finish(session, status);
    return { session: copySession(session) };
  }
  /** Record an independent check performed by the host Agent after a user report. */
  verify(id, owner, verified = false, finish = false) {
    const session = this.sessions.get(id);
    if (!session || this.owners.get(id) !== owner) return { error: 'not_found' };
    this.get(id);
    if (session.continuous && session.status==='awaiting_user' && session.completion?.kind==='observed_condition' && !session.sensitive) {
      session.status='user_action_reported';session.phase='verifying';session.completionSource='agent_observation';session.annotations=[];
    }
    if (!['completed','user_action_reported'].includes(session.status) || session.phase !== 'verifying')
      return { error: 'verification_not_due', session: copySession(session) };
    session.verified = verified === true;
    if(session.continuous){
      if(verified && finish){this.#finish(session,'completed');session.phase='complete';session.nextAction='stop';}
      else{session.status='observing';session.phase='next_step';session.nextAction=verified?'present_next_step':'observe_app';session.recoveryRequired=!verified;session.stepTimeoutAt=this.clock()+1800000;this.#arm(session);}
    }else{
      session.phase = verified === true ? 'complete' : 'next_step';
      session.nextAction = verified === true ? 'stop' : 'observe_app';
    }
    session.updatedAt = this.clock();
    this.emit('change', copySession(session));
    return { session: copySession(session) };
  }
  /** Advance an owned workflow without releasing screen ownership; each step has its own deadline. */
  present(id, input, owner) {
    const current=this.getOwned(id,owner);
    if(!current)return {error:'not_found'};
    if(!current.continuous)return {error:'not_continuous'};
    const normalized=normalizeRequest(input),session=this.sessions.get(id);
    const key=normalized.requestId===null?null:JSON.stringify([owner,normalized.requestId]);
    if(key && this.requestKeys.has(key)){
      const saved=this.requestKeys.get(key);
      if(saved.id!==id||saved.payload!==JSON.stringify(normalized))throw new TypeError('requestId was reused with different content');
      return {session:this.get(id)};
    }
    if(TERMINAL.has(current.status)||this.activeId!==id)return {error:'already_final'};
    if(current.status==='paused')return {error:'paused'};
    if(current.phase==='verifying')return {error:'verification_due'};
    if(current.status!=='observing')return {error:'step_not_verified'};
    for(const field of ['mode','title','message','annotations','visualStyle','motion','locale','density','theme','completion','sensitive','intent','scrim']) session[field]=normalized[field];
    if(normalized.totalSteps!==undefined)session.totalSteps=normalized.totalSteps;
    session.sceneRevision=(session.sceneRevision||0)+1;
    if(normalized.scene)session.scene=normalized.scene;
    else delete session.scene;
    delete session.targetTracking;
    if(!session.recoveryRequired)session.step++;delete session.recoveryRequired;session.status='awaiting_user';session.phase=normalized.mode==='guide'?'presenting':'waiting_user';
    session.nextAction=normalized.mode==='guide'?'observe_app':'wait_for_user';session.verified=false;session.completionSource=null;session.updatedAt=this.clock();
    if(key)this.requestKeys.set(key,{id,payload:JSON.stringify(normalized)});
    session.stepTimeoutAt=this.clock()+normalized.timeoutSeconds*1000;session.confirmationTimeoutAt=normalized.sensitive?this.clock()+Math.min(300,normalized.timeoutSeconds)*1000:null;
    session.agentState={phase:'idle',at:this.clock()};this.#arm(session);
    this.emit('show',copySession(session));return {session:copySession(session)};
  }
  #arm(session) {
    clearTimeout(this.timers.get(session.id));
    session.timeoutAt=Math.min(session.taskTimeoutAt ?? session.timeoutAt,session.status==='paused'?Infinity:session.stepTimeoutAt ?? session.timeoutAt,session.confirmationTimeoutAt ?? Infinity);
    const timer=setTimeout(()=>this.get(session.id),Math.max(1,session.timeoutAt-this.clock()+5));timer.unref?.();this.timers.set(session.id,timer);
  }
  issueResume(id,owner) {
    if(!this.getOwned(id,owner))return null;
    if(this.resumeTokens.has(id))return this.resumeTokens.get(id);
    const token=randomBytes(32).toString('hex');this.resumeTokens.set(id,token);this.resumeKeys.set(id,createHash('sha256').update(token).digest('hex'));
    this.emit('checkpoint');return token;
  }
  getByResumeToken(id,token) {
    const expected=this.resumeKeys.get(id);
    if(!expected || typeof token!=='string' || !/^[0-9a-f]{64}$/.test(token))return null;
    const hash=createHash('sha256').update(token).digest('hex');
    return timingSafeEqual(Buffer.from(hash),Buffer.from(expected))?this.get(id):null;
  }
  resume(id,token,owner) {
    const expected=this.resumeKeys.get(id),hash=createHash('sha256').update(String(token)).digest('hex');
    if(!expected || !timingSafeEqual(Buffer.from(hash),Buffer.from(expected)))return {error:'invalid_resume_token'};
    const session=this.get(id);if(!session || TERMINAL.has(session.status))return {error:'already_final'};
    for(const [key,entry] of this.requestKeys)if(entry.id===id)this.requestKeys.delete(key);
    this.owners.set(id,owner);const s=this.sessions.get(id);s.epoch=(s.epoch||1)+1;
    s.status='observing';s.phase='reconnecting';s.nextAction='observe_app';s.recoveryRequired=true;s.annotations=[];delete s.scene;delete s.targetTracking;
    s.stepTimeoutAt=this.clock()+1800000;s.agentState={phase:'observing',at:this.clock()};this.#arm(s);
    this.resumeTokens.delete(id);const resumeToken=this.issueResume(id,owner);this.emit('change',copySession(s));return {session:copySession(s),resumeToken};
  }
  control(id,owner,action,phase) {
    const s=this.sessions.get(id);if(!s || (owner!==null && this.owners.get(id)!==owner))return {error:'not_found'};
    this.get(id);if(TERMINAL.has(s.status))return {error:'already_final'};
    if(action==='pause') {
      if(s.status==='paused')return {session:copySession(s)};
      s.pausedFrom=s.status;s.remainingMs=Math.max(0,s.stepTimeoutAt-this.clock());s.status='paused';s.phase='paused';s.nextAction='wait_for_resume';s.annotations=[];
    } else if(action==='resume') {
      if(s.status!=='paused')return {error:'not_paused'};
      s.status='observing';s.phase='reconnecting';s.nextAction='observe_app';s.recoveryRequired=true;s.stepTimeoutAt=this.clock()+Math.max(10000,s.remainingMs||1800000);delete s.targetTracking;delete s.scene;
    } else if(action==='retry_target' || action==='text_fallback') {
      if(s.status==='paused')return {error:'paused'};
      s.annotations=[];s.status='observing';s.phase='blocked';s.recoveryRequired=true;s.nextAction=action==='retry_target'?'reobserve_target':'present_text_step';
      delete s.targetTracking;
    } else if(action==='progress') {
      if(!['observing','locating','presenting','verifying','thinking','idle'].includes(phase))throw new TypeError('Invalid agent phase');
      s.agentState={phase,at:this.clock()};
    } else throw new TypeError('Invalid control action');
    s.updatedAt=this.clock();this.#arm(s);this.emit('change',copySession(s));return {session:copySession(s)};
  }
  observed(id,condition) {
    const s=this.sessions.get(id);
    if(!s || s.status!=='awaiting_user' || s.sensitive || s.completion?.kind!=='observed_condition' || s.completion.condition!==condition)return false;
    s.status='user_action_reported';s.phase='verifying';s.nextAction='verify_in_app';s.completionSource='native_observation';s.annotations=[];
    s.stepTimeoutAt=this.clock()+1800000;this.#arm(s);this.emit('change',copySession(s));return true;
  }
  exportCheckpoint() {
    const s=this.activeId && this.sessions.get(this.activeId);
    if(!s || !s.continuous || s.demo || TERMINAL.has(s.status))return null;
    return {version:1,id:s.id,owner:this.owners.get(s.id),resumeHash:this.resumeKeys.get(s.id),step:s.step,epoch:s.epoch,taskTimeoutAt:s.taskTimeoutAt,sensitive:s.sensitive,confirmationTimeoutAt:s.confirmationTimeoutAt};
  }
  restoreCheckpoint(c) {
    if(!c || c.version!==1 || !/^[0-9a-f-]{36}$/.test(c.id||'') || !/^[0-9a-f]{64}$/.test(c.resumeHash||'') || typeof c.owner!=='string' || !c.owner || c.owner.length>128 || !Number.isFinite(c.taskTimeoutAt) || c.taskTimeoutAt>this.clock()+86400000 || c.taskTimeoutAt<=this.clock() || (c.sensitive && c.confirmationTimeoutAt && c.confirmationTimeoutAt<=this.clock()))return false;
    const now=this.clock(),s={id:c.id,continuous:true,mode:'handoff',title:'恢复引导',message:'回到原会话继续。',annotations:[],completion:{kind:'user_report'},status:'observing',phase:'reconnecting',nextAction:'observe_app',createdAt:now,updatedAt:now,step:c.step||1,epoch:c.epoch||1,taskTimeoutAt:c.taskTimeoutAt,stepTimeoutAt:now+1800000,confirmationTimeoutAt:c.confirmationTimeoutAt,sensitive:c.sensitive,recoveryRequired:true,verified:false,agentState:{phase:'idle',at:now}};
    this.sessions.set(s.id,s);this.owners.set(s.id,c.owner);this.resumeKeys.set(s.id,c.resumeHash);this.activeId=s.id;this.#arm(s);return true;
  }
  stopActive() {const session=this.activeId&&this.sessions.get(this.activeId);if(session)this.#finish(session,'cancelled');}
  /** Optimistic, owner-scoped and atomic scene change; never renews the handoff TTL. */
  updateScene(id, owner, expectedRevision, operations) {
    if (this.owners.get(id) !== owner) return { error: 'not_found' };
    const session = this.sessions.get(id);
    this.get(id); // Re-evaluate expiration first.
    if (TERMINAL.has(session.status) || this.activeId !== id) return { error: 'already_final' };
    if (!session.scene) return { error: 'scene_not_enabled' };
    if(session.continuous && session.status!=='awaiting_user')return {error:'verification_due'};
    if (['lost','layout_changed','desktop_unavailable'].includes(session.targetTracking?.status))
      return { error: 'target_unavailable' };
    if (!Number.isInteger(expectedRevision) || expectedRevision !== session.sceneRevision) {
      return { error: 'revision_conflict', sceneRevision: session.sceneRevision };
    }
    const next = patchScene(session.scene, operations);
    const flattened = flattenScene(next);
    // Allow temporarily hiding every layer to clear the screen without finishing a handoff.
    session.scene = next;
    session.annotations = flattened;
    // A manual scene edit transfers control from native auto-follow to the Agent.
    if (session.targetTracking) session.targetTracking = { status: 'manual', observedAt: null };
    session.sceneRevision++;
    session.phase = session.mode==='handoff'?'waiting_user':'presenting';
    session.nextAction = session.mode==='handoff'?'wait_for_user':'observe_app';
    session.updatedAt = this.clock();
    this.emit('show', copySession(session));
    return { session: copySession(session) };
  }
  /** Broker-owned ephemeral location refresh. Does not extend TTL or report completion. */
  setAnchorState(id, {status, annotations, scene, observedAt, signature, reason}) {
    const session=this.sessions.get(id);
    if(!session || this.activeId!==id || session.status!=='awaiting_user')return {error:'not_active'};
    if(!['tracking','lost','layout_changed','desktop_unavailable'].includes(status))throw new TypeError('Invalid anchor state');
    const previous=session.targetTracking;
    const changed=!previous || previous.status!==status ||
      previous.signature!==signature || previous.reason!==reason || JSON.stringify(session.annotations)!==JSON.stringify(annotations);
    if(!changed)return {session:copySession(session),changed:false};
    session.annotations=annotations.map(a=>({...a}));
    if(scene && session.scene && JSON.stringify(scene)!==JSON.stringify(session.scene)) {
      session.scene=scene;session.sceneRevision++;
    }
    session.targetTracking={status,observedAt,signature,...(reason?{reason}:{})};
    session.phase = status === 'tracking' ? (session.mode==='handoff'?'waiting_user':'presenting') : 'blocked';
    session.nextAction = status === 'tracking' ? (session.mode==='handoff'?'wait_for_user':'observe_app') :
      (reason === 'consent_required' || reason === 'permission_denied' ? 'check_accessibility_permission' : 'reobserve_target');
    session.updatedAt=this.clock();
    this.emit('show',copySession(session));
    return {session:copySession(session),changed:true};
  }
  #finish(session, status) {
    if (TERMINAL.has(session.status)) return;
    const timer = this.timers.get(session.id);
    if (timer) clearTimeout(timer);
    this.timers.delete(session.id);
    session.status = status;
    session.phase = status === 'completed' ? (session.continuous?'complete':'verifying') : 'finished';
    session.nextAction = status === 'completed' && !session.continuous ? 'verify_in_app' : 'stop';
    session.updatedAt = this.clock();
    session.completionSource = status === 'completed' ? (session.completionSource || 'user_report') : null;
    if (this.activeId === session.id) this.activeId = null;
    this.emit('change', copySession(session));
  }
  async wait(id, timeoutMs = 15000) {
    const initial = this.get(id);
    if (!initial) return { error: 'not_found' };
    if (TERMINAL.has(initial.status)) return { session: initial };
    const ms = Math.max(0, Math.min(30000, Number.isFinite(timeoutMs) ? timeoutMs : 15000));
    if (this.pendingWaits >= 64) return { error: 'too_many_waits' };
    this.pendingWaits++;
    return new Promise(resolve => {
      let settled = false;
      const finish = result => {
        if (settled) return;
        settled = true;
        this.pendingWaits--;
        clearTimeout(timer);
        this.off('change', onChange);
        resolve(result);
      };
      const onChange = event => {
        if (event.id === id && TERMINAL.has(event.status)) finish({ session: this.get(id) });
      };
      this.on('change', onChange);
      const timer = setTimeout(() => finish({ session: this.get(id), pending: true }), ms);
      const current = this.get(id);
      if (!current || TERMINAL.has(current.status)) finish({ session: current });
    });
  }
  #prune() {
    if (this.sessions.size <= this.maxHistory) return;
    for (const [id, session] of this.sessions) {
      if (this.sessions.size <= this.maxHistory) break;
      if (TERMINAL.has(session.status)) {
        this.sessions.delete(id); this.owners.delete(id);this.resumeKeys.delete(id);this.resumeTokens.delete(id);
        for (const [key, entry] of this.requestKeys) if (entry.id === id) this.requestKeys.delete(key);
      }
    }
  }
  close() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.emit('closing');
  }
}
