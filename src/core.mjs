import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

export const TERMINAL_STATES = Object.freeze(['completed', 'declined', 'cancelled', 'expired', 'superseded']);
const TERMINAL = new Set(TERMINAL_STATES);
export const SHAPES = Object.freeze(['arrow', 'ring', 'box', 'spotlight']);
const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_ANNOTATIONS = 8;

function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function finiteCoord(value, key) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 100000) {
    throw new TypeError(`${key} must be a finite global DIP coordinate within ±100000`);
  }
  return value;
}
function optionalSize(value, key) {
  if (value === undefined || value === null) return null;
  if (!Number.isFinite(value) || value <= 0 || value > 5000) throw new TypeError(`${key} must be greater than 0 and <= 5000`);
  return value;
}
export function normalizeAnnotation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Annotation must be an object');
  const shape = input.shape ?? 'arrow';
  if (!SHAPES.includes(shape)) throw new TypeError('Unknown annotation shape');
  const color = input.color ?? '#50dbb4';
  if (typeof color !== 'string' || !HEX.test(color)) throw new TypeError('Color must be a six-digit hex color');
  return {
    x: finiteCoord(input.x, 'x'), y: finiteCoord(input.y, 'y'),
    shape, color, width: optionalSize(input.width, 'width'), height: optionalSize(input.height, 'height'),
    label: text(input.label, 64)
  };
}
export function normalizeRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Request must be an object');
  const mode = input.mode ?? 'handoff';
  if (mode !== 'guide' && mode !== 'handoff') throw new TypeError('Invalid presentation mode');
  const title = text(input.title, 100);
  const message = text(input.message, 1000);
  if (!title || !message) throw new TypeError('title and message are required');
  const timeoutSeconds = input.timeoutSeconds ?? (mode === 'guide' ? 90 : 300);
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 10 || timeoutSeconds > 3600) {
    throw new TypeError('timeoutSeconds must be an integer between 10 and 3600');
  }
  let annotations;
  if (input.annotations !== undefined) {
    if (!Array.isArray(input.annotations) || input.annotations.length > MAX_ANNOTATIONS) {
      throw new TypeError(`annotations must be an array of at most ${MAX_ANNOTATIONS} items`);
    }
    annotations = input.annotations.map(normalizeAnnotation);
    if (input.x !== undefined || input.y !== undefined) throw new TypeError('Choose annotations or x/y shorthand, not both');
  } else if (input.x !== undefined || input.y !== undefined) {
    annotations = [normalizeAnnotation(input)];
  } else {
    annotations = [];
  }
  if (mode === 'guide' && annotations.length === 0) {
    throw new TypeError('Visual guidance requires grounded annotation coordinates');
  }
  return { mode, title, message, timeoutSeconds, annotations };
}
function copySession(session) {
  if (!session) return null;
  return { ...session, annotations: session.annotations.map(a => ({ ...a })) };
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
    this.timers = new Map();
    this.activeId = null;
  }
  show(input) {
    const normalized = normalizeRequest(input);
    const previous = this.activeId && this.sessions.get(this.activeId);
    if (previous && !TERMINAL.has(previous.status)) this.#finish(previous, 'superseded');
    const now = this.clock();
    const session = {
      id: randomUUID(), mode: normalized.mode, title: normalized.title,
      message: normalized.message, annotations: normalized.annotations,
      status: 'awaiting_user', createdAt: now, updatedAt: now,
      timeoutAt: now + normalized.timeoutSeconds * 1000,
      completionSource: null, verified: false
    };
    this.sessions.set(session.id, session);
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
  resolve(id, status) {
    if (!['completed', 'declined', 'cancelled'].includes(status)) throw new TypeError('Invalid decision');
    const session = this.sessions.get(id);
    if (!session) return { error: 'not_found' };
    this.get(id); // expiry always wins over a late response
    if (TERMINAL.has(session.status)) return { error: 'already_final', session: copySession(session) };
    if (this.activeId !== id) return { error: 'not_active' };
    this.#finish(session, status);
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
    return new Promise(resolve => {
      let settled = false;
      const finish = result => {
        if (settled) return;
        settled = true;
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
      if (TERMINAL.has(session.status)) this.sessions.delete(id);
    }
  }
  close() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
