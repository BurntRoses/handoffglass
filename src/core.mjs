import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

export const TERMINAL_STATES = Object.freeze(['completed', 'declined', 'cancelled', 'expired', 'superseded']);
const TERMINAL = new Set(TERMINAL_STATES);
import { VISUAL_STYLES, MOTION_MODES, LOCALES } from './local/preferences.mjs';
import { SHAPES, normalizeAnnotation, normalizeScene, flattenScene, patchScene, composeTemplate, MAX_MARKS } from './visual/scene.mjs';
export { SHAPES, normalizeAnnotation } from './visual/scene.mjs';
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export function normalizeRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Request must be an object');
  const mode = input.mode ?? 'handoff';
  const locale = input.locale ?? 'zh-CN';
  const density = input.density ?? 'normal';
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
  return { mode, title, message, timeoutSeconds, annotations, requestId, visualStyle, motion, locale, density, ...(scene ? { scene } : {}) };
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
      visualStyle: normalized.visualStyle, motion: normalized.motion, locale:normalized.locale, density:normalized.density,
      ...(normalized.scene ? {scene:normalized.scene, sceneRevision:1} : {}),
      status: 'awaiting_user', createdAt: now, updatedAt: now,
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
    this.#finish(session, status);
    return { session: copySession(session) };
  }
  /** Optimistic, owner-scoped and atomic scene change; never renews the handoff TTL. */
  updateScene(id, owner, expectedRevision, operations) {
    if (this.owners.get(id) !== owner) return { error: 'not_found' };
    const session = this.sessions.get(id);
    this.get(id); // Re-evaluate expiration first.
    if (TERMINAL.has(session.status) || this.activeId !== id) return { error: 'already_final' };
    if (!session.scene) return { error: 'scene_not_enabled' };
    if (!Number.isInteger(expectedRevision) || expectedRevision !== session.sceneRevision) {
      return { error: 'revision_conflict', sceneRevision: session.sceneRevision };
    }
    const next = patchScene(session.scene, operations);
    const flattened = flattenScene(next);
    // Allow temporarily hiding every layer to clear the screen without finishing a handoff.
    session.scene = next;
    session.annotations = flattened;
    session.sceneRevision++;
    session.updatedAt = this.clock();
    this.emit('show', copySession(session));
    return { session: copySession(session) };
  }
  #finish(session, status) {
    if (TERMINAL.has(session.status)) return;
    const timer = this.timers.get(session.id);
    if (timer) clearTimeout(timer);
    this.timers.delete(session.id);
    session.status = status;
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
