import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { validDisplay, canLocateAll } from './geometry.mjs';
import { loadPreferences, hasUserPreferences } from './local/preferences.mjs';
import { compileBlueprint, BLUEPRINT_NAMES } from './local/blueprints.mjs';
import { locateNative, inspectNative, validateTarget } from './native/locator.mjs';
import { GroundingError } from './visual/grounding.mjs';
import { HostActivity } from './local/host-activity.mjs';
import { layoutSignature, compareObservation } from './native/calibration.mjs';
import { NativeAnchorTracker } from './native/anchor-tracker.mjs';
import { InteractionJournal, recoveryFor } from './local/interaction-journal.mjs';

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
    this.resolvedTargets = new Map(); // owner/requestId -> original and grounded payload for safe retry
    this.revision = 0;
    this.waiters = new Set();
    this.anchors = new NativeAnchorTracker({manager,locator:(target, displays)=>this.locator(target,displays),
      getDisplays:()=>this.displays,desktopReady:()=>this.headless || this.connected});
    this.onManagerChange = () => this.#publish();
    manager.on('show', this.onManagerChange);
    manager.on('change', this.onManagerChange);
  }
  get connected() { return Date.now() - this.lastPoll < 35000; }
  snapshot() { return { revision: this.revision, active: this.manager.active() }; }
  #publish() {
    this.revision++;
    for (const responder of [...this.waiters]) responder(this.snapshot());
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
    this.anchors.close();
    this.journal.close();
    for (const respond of [...this.waiters]) respond(this.snapshot());
    if (this.server) {
      await new Promise(resolve => this.server.close(resolve));
      this.server = null;
    }
    this.manager.off('show', this.onManagerChange);
    this.manager.off('change', this.onManagerChange);
  }
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
      '/agent/displays': 'GET', '/agent/inspect': 'GET', '/agent/show': 'POST', '/agent/status': 'GET',
      '/agent/wait': 'GET', '/agent/events': 'GET', '/agent/cancel': 'POST', '/agent/context': 'GET', '/agent/blueprint': 'POST', '/agent/scene': 'POST', '/agent/locate': 'POST' };
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
        height: d.height, scaleFactor: Number.isFinite(d.scaleFactor) ? d.scaleFactor : 1,
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
        handoff: active ? { status: active.status, mode: active.mode, timeoutAt: active.timeoutAt } : null,
        hostActivity: this.hostActivity.snapshot(),
        timeline: this.journal.recent(12)
      });
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
      this.hostActivity.record(req.headers['x-handoffglass-host'], pathname);
      if (req.method === 'GET' && pathname === '/agent/displays') {
        await this.prepare();
        return sendJson(res, 200, { displays: this.displays, connected: this.connected, headless: this.headless });
      }
      if (req.method === 'GET' && pathname === '/agent/inspect') {
        await this.prepare();
        if (!this.headless && !this.connected) return sendJson(res,503,{error:'Desktop unavailable',code:'no_desktop'});
        return sendJson(res,200,await this.inspector(this.displays));
      }
      if (req.method === 'GET' && pathname === '/agent/context') {
        const preferences = await loadPreferences();
        return sendJson(res, 200, { preferences, storage: 'local', historyStored: false, modelCallRequired: false });
      }
      if (req.method === 'POST' && pathname === '/agent/blueprint') {
        const { blueprint, locale } = await readJson(req);
        if (!BLUEPRINT_NAMES.includes(blueprint)) return sendJson(res, 400, { error: 'Unknown blueprint' });
        const preferences = await loadPreferences();
        return sendJson(res, 200, compileBlueprint(blueprint, { locale: locale || preferences.locale }));
      }
      if (req.method === 'POST' && pathname === '/agent/locate') {
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
        return sendJson(res, 200, { target: {...located, layoutSignature:signature},
          ...(comparison ? { comparison } : {}), coordinateSystem: 'global_DIP',
          warning: 'This is an observation, not permission to click or approve. Revalidate after UI changes.' });
      }
      if (req.method === 'POST' && pathname === '/agent/show') {
        const body = await readJson(req);
        const original = JSON.stringify(body);
        const hadTarget = body.target !== undefined;
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
          delete body.target;
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
          anchoredQuery=target;anchoredHit=hit;
          delete body.target;
          body.x = hit.x; body.y = hit.y; body.width = hit.width; body.height = hit.height;
        }
        // Apply user-owned visual preferences; Agents cannot persist them.
        const preference = await loadPreferences();
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
        const session = this.manager.show(body, owner);
        if (session.error) return sendJson(res, 409, { error: 'A different Agent already owns the active handoff', code: 'busy' });
        if (anchoredQuery && followTarget) this.anchors.track(session.id,anchoredQuery,anchoredHit);
        if (retryKey && !previous && hadTarget) {
          this.resolvedTargets.set(retryKey,{original,resolved:structuredClone(body)});
          if(this.resolvedTargets.size > 128) this.resolvedTargets.delete(this.resolvedTargets.keys().next().value);
        }
        return sendJson(res, 200, { session: this.manager.get(session.id), visible: !this.headless,
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
        return sendJson(res, 200, await this.manager.waitOwned(id, owner, ms));
      }
      if (req.method === 'POST' && pathname === '/agent/scene') {
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
      const result = this.manager.resolve(body.id, body.status);
      return sendJson(res, result.error ? 409 : 200, result);
    }
    return sendJson(res, 404, { error: 'Unknown endpoint' });
  }
}
