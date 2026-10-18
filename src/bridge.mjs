import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { validDisplay, canLocateAll } from './geometry.mjs';
import { locateNative, validateTarget } from './native/locator.mjs';

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
  constructor(manager, { prepare = async () => {}, headless = false, locator = locateNative } = {}) {
    this.manager = manager;
    this.prepare = prepare;
    this.headless = headless;
    this.locator = locator;
    this.token = randomBytes(32).toString('hex'); // Desktop-only capability.
    this.agentToken = randomBytes(32).toString('hex'); // MCP client capability.
    this.server = null;
    this.port = null;
    this.lastPoll = 0;
    this.displays = [];
    this.revision = 0;
    this.waiters = new Set();
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
        sendJson(res, error.httpCode || 400, { error: error.message });
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
    const routes = { '/hello': 'POST', '/health': 'GET', '/state': 'GET', '/poll': 'GET', '/decision': 'POST',
      '/agent/displays': 'GET', '/agent/show': 'POST', '/agent/status': 'GET',
      '/agent/wait': 'GET', '/agent/cancel': 'POST', '/agent/scene': 'POST', '/agent/locate': 'POST' };
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
      this.displays = body.displays.map(d => ({
        id: d.id, x: d.x, y: d.y, width: d.width,
        height: d.height, scaleFactor: Number.isFinite(d.scaleFactor) ? d.scaleFactor : 1,
        ...(d.physicalBounds ? { physicalBounds: d.physicalBounds } : {})
      }));
      this.lastPoll = Date.now();
      return sendJson(res, 200, { ok: true, ...this.snapshot() });
    }
    if (req.method === 'GET' && pathname === '/health') {
      return sendJson(res, 200, { ok: true, pid: process.pid, protocol: 1 });
    }
    if (req.method === 'GET' && pathname === '/state') {
      return sendJson(res, 200, this.snapshot());
    }
    if (pathname.startsWith('/agent/')) {
      const owner = req.headers['x-handoffglass-owner'];
      if (typeof owner !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(owner)) {
        return sendJson(res, 403, { error: 'Agent identity is required', code: 'invalid_owner' });
      }
      if (req.method === 'GET' && pathname === '/agent/displays') {
        await this.prepare();
        return sendJson(res, 200, { displays: this.displays, connected: this.connected, headless: this.headless });
      }
      if (req.method === 'POST' && pathname === '/agent/locate') {
        const body = await readJson(req);
        const target = validateTarget(body.target);
        await this.prepare();
        if (!this.headless && !this.connected) return sendJson(res, 503, { error: 'Desktop unavailable', code: 'no_desktop' });
        const located = await this.locator(target, this.displays);
        return sendJson(res, 200, { target: located, coordinateSystem: 'global_DIP',
          warning: 'This is an observation, not permission to click or approve. Revalidate after UI changes.' });
      }
      if (req.method === 'POST' && pathname === '/agent/show') {
        const body = await readJson(req);
        if (body.target !== undefined) {
          const target = validateTarget(body.target);
          if (body.x !== undefined || body.y !== undefined || body.annotations !== undefined ||
              body.scene !== undefined) return sendJson(res, 400, { error: 'Choose target or coordinates/scene', code: 'invalid_target' });
          await this.prepare();
          if (!this.headless && !this.connected) return sendJson(res, 503, { error: 'Desktop unavailable', code: 'no_desktop' });
          const hit = await this.locator(target, this.displays);
          delete body.target;
          body.x = hit.x; body.y = hit.y; body.width = hit.width; body.height = hit.height;
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
        return sendJson(res, 200, { session, visible: !this.headless,
          coordinateSystem: 'global_DIP',
          instruction: 'User-reported completion is not verification. Recheck the target application.' });
      }
      if (req.method === 'GET' && pathname === '/agent/status') {
        const id = parsed.searchParams.get('sessionId');
        return sendJson(res, 200, { session: this.manager.getOwned(id, owner), connected: this.connected });
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
        const result = this.manager.updateScene(body.sessionId, owner, body.expectedRevision, body.operations);
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
