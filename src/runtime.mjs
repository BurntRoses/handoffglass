import { tmpdir, homedir } from 'node:os';
import { join, resolve, isAbsolute } from 'node:path';
import { lstat, mkdir, readFile, writeFile, rename, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const launchTimeout = 18000;

export function runtimeDir(env = process.env) {
  const candidate = env.HANDOFFGLASS_RUNTIME_DIR;
  if (candidate && !isAbsolute(candidate)) throw new Error('HANDOFFGLASS_RUNTIME_DIR must be absolute');
  return resolve(candidate || join(homedir(), '.handoffglass'));
}
export async function secureRuntimeDir(dir) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const s = await lstat(dir);
  if (!s.isDirectory() || s.isSymbolicLink()) throw new Error('Insecure runtime directory');
  if (process.platform !== 'win32') {
    if (s.uid !== process.getuid() || (s.mode & 0o077) !== 0) {
      throw new Error('Runtime directory must be owned by the current user and chmod 700');
    }
  }
  return dir;
}
export async function readManifest(dir) {
  try {
    const file = join(dir, 'broker.json');
    const s = await lstat(file);
    if (!s.isFile() || s.isSymbolicLink()) return null;
    if (process.platform !== 'win32' && (s.uid !== process.getuid() || (s.mode & 0o077) !== 0)) return null;
    const info = JSON.parse(await readFile(file, 'utf8'));
    if (!Number.isInteger(info.port) || info.port < 1 || info.port > 65535 ||
        !/^[0-9a-f]{64}$/.test(info.token) || !Number.isInteger(info.pid) || info.pid <= 0) return null;
    return info;
  } catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return null; throw error; }
}
export async function writeManifest(dir, data) {
  const name = join(dir, `.broker-${randomUUID()}.tmp`);
  await writeFile(name, JSON.stringify(data), { mode: 0o600, flag: 'wx' });
  try { await rename(name, join(dir, 'broker.json')); }
  finally { await rm(name, { force: true }); }
}
export async function probe(info, timeoutMs = 900) {
  try {
    const response = await fetch(`http://127.0.0.1:${info.port}/health`, {
      headers: { authorization: `Bearer ${info.token}` }, signal: AbortSignal.timeout(timeoutMs)
    });
    const body = await response.json();
    return response.ok && body.ok && body.pid === info.pid;
  } catch { return false; }
}

/** Serialize starting a broker without relying on fixed ports or a public network listener. */
export async function ensureBroker({ env = process.env, spawnBroker = null, timeoutMs = launchTimeout } = {}) {
  const dir = await secureRuntimeDir(runtimeDir(env));
  const live = await readManifest(dir);
  if (live && await probe(live)) return live;
  const lock = join(dir, '.startup-lock');
  const deadline = Date.now() + timeoutMs;
  let locked = false;
  while (Date.now() < deadline) {
    try { await mkdir(lock, { mode: 0o700 }); locked = true; break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        const s = await stat(lock);
        // A dead launcher must not leave the user permanently locked out.
        if (Date.now() - s.mtimeMs > 25000) await rm(lock, { recursive: true, force: true });
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const waiting = await readManifest(dir);
      if (waiting && await probe(waiting)) return waiting;
      await pause(120);
    }
  }
  if (!locked) throw new Error('Timed out acquiring the local broker startup lock');
  try {
    const current = await readManifest(dir);
    if (current && await probe(current, 1800)) return current;
    // Windows cannot reliably atomically replace an existing broker.json via rename().
    // Under the exclusive startup lock, discard the stale manifest before a fresh launch.
    if (current) await rm(join(dir, 'broker.json'), { force: true });
    let launchError = null;
    if (spawnBroker) await spawnBroker(dir);
    else {
      const child = spawn(process.execPath, [fileURLToPath(new URL('./broker.mjs', import.meta.url))], {
        cwd: dir, env: { ...env, HANDOFFGLASS_RUNTIME_DIR: dir },
        detached: true, windowsHide: true, stdio: 'ignore'
      });
      child.once('error', error => { launchError = error; });
      child.unref();
    }
    while (Date.now() < deadline) {
      if (launchError) throw new Error(`Broker process launch failed: ${launchError.message}`);
      const info = await readManifest(dir);
      if (info && await probe(info)) return info;
      await pause(120);
    }
    throw new Error('The local broker failed to start; check Node.js and the runtime directory');
  } finally { await rm(lock, { recursive: true, force: true }); }
}
/** A mutating request may have succeeded before the socket dropped.
 * Only retry a handoff POST when an idempotency key makes replay safe. */
export function safeBrokerRetry(path, method, body) {
  return method === 'GET' ||
    (path === '/agent/show' && method === 'POST' && typeof body?.requestId === 'string' && body.requestId.length >= 8) ||
    (path === '/agent/cancel' && method === 'POST' && typeof body?.sessionId === 'string');
}
export class BrokerClient {
  constructor(options = {}) { this.options = options; this.ownerId = randomUUID(); }
  async request(path, { method = 'GET', body, timeoutMs = 34000 } = {}) {
    let info = await ensureBroker(this.options);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(`http://127.0.0.1:${info.port}${path}`, {
          method, headers: {
            authorization: `Bearer ${info.token}`, 'x-handoffglass-owner': this.ownerId,
            ...(body === undefined ? {} : { 'content-type': 'application/json' })
          }, body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs)
        });
        const result = await response.json();
        if (!response.ok) throw Object.assign(new Error(result.error || 'Broker request failed'), { code: result.code, httpCode: response.status });
        return result;
      } catch (error) {
        if (error.httpCode || attempt || !safeBrokerRetry(path, method, body)) throw error;
        info = await ensureBroker(this.options);
      }
    }
  }
  async present(mode, args) { return this.request('/agent/show', { method: 'POST', body: { ...args, mode } }); }
  async displays() { return this.request('/agent/displays'); }
  async status(sessionId) { return this.request(`/agent/status?sessionId=${encodeURIComponent(sessionId)}`); }
  async wait(sessionId, maxWaitSeconds) {
    return this.request(`/agent/wait?sessionId=${encodeURIComponent(sessionId)}&maxWaitMs=${Math.round(maxWaitSeconds * 1000)}`);
  }
  async updateScene(sessionId, expectedRevision, operations) {
    return this.request('/agent/scene', { method: 'POST', body: { sessionId, expectedRevision, operations } });
  }
  async locate(target) { return this.request('/agent/locate', { method: 'POST', body: { target } }); }
  async cancel(sessionId) { return this.request('/agent/cancel', { method: 'POST', body: { sessionId } }); }
}
