import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { validDisplay } from './geometry.mjs';

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
  constructor(manager) {
    this.manager = manager;
    this.token = randomBytes(32).toString('hex');
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
    const expected = Buffer.from(`Bearer ${this.token}`);
    const provided = Buffer.from(req.headers.authorization || '');
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }
    const pathname = new URL(req.url, `http://${host}`).pathname;
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
        height: d.height, scaleFactor: Number.isFinite(d.scaleFactor) ? d.scaleFactor : 1
      }));
      this.lastPoll = Date.now();
      return sendJson(res, 200, { ok: true, ...this.snapshot() });
    }
    if (req.method === 'GET' && pathname === '/state') {
      this.lastPoll = Date.now();
      return sendJson(res, 200, this.snapshot());
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
