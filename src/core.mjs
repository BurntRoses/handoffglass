import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

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
  const timeoutSeconds = input.timeoutSeconds ?? (mode === 'guide' ? 90 : 300);
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 10 || timeoutSeconds > 3600) {
    throw new TypeError('timeoutSeconds must be an integer between 10 and 3600');
  }
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
  return { continuous:input.continuous===true, mode, title, message, timeoutSeconds, annotations, requestId, visualStyle, motion, locale, density, theme, ...(scene ? { scene } : {}) };
}
function copySession(session) {
  if (!session) return null;
  return { ...session, annotations: session.annotations.map(a => ({ ...a })),
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
      continuous: input.continuous === true, step: 1,
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
    const timer = setTimeout(() => this.get(session.id), normalized.timeoutSeconds * 1000 + 5);
    timer.unref?.();
    this.timers.set(session.id, timer);
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
    if(status==='completed' && session.continuous){
      if(session.status!=='awaiting_user')return {error:'verification_due',session:copySession(session)};
      session.status='user_action_reported';session.phase='verifying';session.nextAction='verify_in_app';
      session.completionSource='user_report';session.updatedAt=this.clock();session.annotations=[];
      this.emit('change',copySession(session));
    }else this.#finish(session, status);
    return { session: copySession(session) };
  }
  /** Record an independent check performed by the host Agent after a user report. */
  verify(id, owner, verified = false, finish = false) {
    const session = this.sessions.get(id);
    if (!session || this.owners.get(id) !== owner) return { error: 'not_found' };
    this.get(id);
    if (!['completed','user_action_reported'].includes(session.status) || session.phase !== 'verifying')
      return { error: 'verification_not_due', session: copySession(session) };
    session.verified = verified === true;
    if(session.continuous){
      if(verified && finish){this.#finish(session,'completed');session.phase='complete';session.nextAction='stop';}
      else{session.status='observing';session.phase='next_step';session.nextAction=verified?'present_next_step':'observe_app';}
    }else{
      session.phase = verified === true ? 'complete' : 'next_step';
      session.nextAction = verified === true ? 'stop' : 'observe_app';
    }
    session.updatedAt = this.clock();
    this.emit('change', copySession(session));
    return { session: copySession(session) };
  }
  /** Advance an owned workflow without releasing screen ownership or renewing its TTL. */
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
    if(current.phase==='verifying')return {error:'verification_due'};
    for(const field of ['mode','title','message','annotations','visualStyle','motion','locale','density','theme']) session[field]=normalized[field];
    session.sceneRevision=(session.sceneRevision||0)+1;
    if(normalized.scene)session.scene=normalized.scene;
    else delete session.scene;
    delete session.targetTracking;
    session.step++;session.status='awaiting_user';session.phase=normalized.mode==='guide'?'presenting':'waiting_user';
    session.nextAction=normalized.mode==='guide'?'observe_app':'wait_for_user';session.verified=false;session.completionSource=null;session.updatedAt=this.clock();
    if(key)this.requestKeys.set(key,{id,payload:JSON.stringify(normalized)});
    this.emit('show',copySession(session));return {session:copySession(session)};
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
    if(!session || this.activeId!==id || TERMINAL.has(session.status))return {error:'not_active'};
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
    session.completionSource = status === 'completed' ? 'user_report' : null;
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
        this.sessions.delete(id); this.owners.delete(id);
        for (const [key, entry] of this.requestKeys) if (entry.id === id) this.requestKeys.delete(key);
      }
    }
  }
  close() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
