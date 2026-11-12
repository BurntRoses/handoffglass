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
    (['/agent/show','/agent/mark'].includes(path) && method === 'POST' && typeof body?.requestId === 'string' && body.requestId.length >= 8) ||
    (path === '/agent/cancel' && method === 'POST' && typeof body?.sessionId === 'string');
}
export class BrokerClient {
  constructor(options = {}) {
    this.options = options; this.ownerId = randomUUID();
    const env = options.env || process.env;
    this.connectionId=typeof env.HANDOFFGLASS_CONNECTION_ID==='string'?env.HANDOFFGLASS_CONNECTION_ID:'';
    this.declaredHost = typeof env.HANDOFFGLASS_HOST_ID === 'string' ? env.HANDOFFGLASS_HOST_ID : '';
  }
  withSignal(signal){
    const client=Object.create(this);client.options={...this.options,signal};
    Object.defineProperty(client,'live',{get:()=>this.live,set:value=>{this.live=value;}});return client;
  }
  async request(path, { method = 'GET', body, timeoutMs = 34000 } = {}) {
    this.options.signal?.throwIfAborted();
    let info = this.live || await ensureBroker(this.options);
    this.live=info;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(`http://127.0.0.1:${info.port}${path}`, {
          method, headers: {
            authorization: `Bearer ${info.token}`, 'x-handoffglass-owner': this.ownerId, 'x-handoffglass-host': this.declaredHost, 'x-handoffglass-connection':this.connectionId,
            ...(body === undefined ? {} : { 'content-type': 'application/json' })
          }, body: body === undefined ? undefined : JSON.stringify(body),
          signal: this.options.signal?AbortSignal.any([this.options.signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs)
        });
        const result = await response.json();
        if (!response.ok) throw Object.assign(new Error(result.error || 'Broker request failed'), { code: result.code, httpCode: response.status, ...(result.nextAction?{nextAction:result.nextAction}:{}) });
        return result;
      } catch (error) {
        if(!error.httpCode)this.live=null;
        // A refused connection sent no request bytes; other failures may have committed.
        const unsent=error.cause?.code==='ECONNREFUSED';
        if (this.options.signal?.aborted || error.httpCode || attempt || (!unsent && !safeBrokerRetry(path, method, body))) throw error;
        info = await ensureBroker(this.options);this.live=info;
      }
    }
  }
  async context() { return this.request('/agent/context'); }
  async capabilities() { return this.request('/agent/capabilities'); }
  async connection() { return this.request('/agent/connection'); }
  async setEnabled(enabled) { return this.request('/agent/integration-enabled',{method:'POST',body:{enabled}}); }
  async permissions() { return this.request('/agent/permissions'); }
  async integrationStatus(host = 'codex') { return this.request(`/agent/integration-status?host=${encodeURIComponent(host)}`); }
  async uninstall(confirm=false){return this.request('/agent/integration-uninstall',{method:'POST',body:{confirm}});}
  async cleanupIntegration(host, confirm = false) { return this.request('/agent/integration-cleanup', { method: 'POST', body: { host, confirm } }); }
  async blueprint(blueprint, locale) { return this.request('/agent/blueprint', { method: 'POST', body: { blueprint, locale } }); }
  async present(mode, args) { return this.request('/agent/show', { method: 'POST', body: { ...args, mode } }); }
  async displays() { return this.request('/agent/displays'); }
  async mark(args) { return this.request('/agent/mark',{method:'POST',body:args}); }
  async inspect() {
    try { return await this.request('/agent/inspect'); }
    catch(error) {
      if(error.httpCode === 404) throw Object.assign(new Error('Restart HandoffGlass to load UI inspection, then retry.'),{code:'broker_upgrade_required'});
      throw error;
    }
  }
  async status(sessionId) { return this.request(`/agent/status?sessionId=${encodeURIComponent(sessionId)}`); }
  async events(sessionId,after=0,limit=20) { return this.request(`/agent/events?sessionId=${encodeURIComponent(sessionId)}&after=${after}&limit=${limit}`); }
  async wait(sessionId, maxWaitSeconds, { continuous = false, cursor=0 } = {}) {
    return this.request(`/agent/wait?sessionId=${encodeURIComponent(sessionId)}&maxWaitMs=${Math.round(maxWaitSeconds * 1000)}${continuous ? `&continuous=1&cursor=${cursor}` : ''}`);
  }
  async resume(sessionId,resumeToken){return this.request('/agent/resume',{method:'POST',body:{sessionId,resumeToken}});}
  async control(sessionId,action,phase,expectedStep){return this.request('/agent/control',{method:'POST',body:{sessionId,action,phase,expectedStep}});}
  async review(args){return this.request('/agent/review',{method:'POST',body:args});}
  async verify(sessionId, verified, finish=false,expectedStep) {
    return this.request('/agent/verify', { method: 'POST', body: { sessionId, ...(typeof verified==='boolean'?{verified}:{result:verified}), finish, expectedStep } });
  }
  async updateScene(sessionId, expectedRevision, operations, region={}) {
    return this.request('/agent/scene', { method: 'POST', body: { ...region, sessionId, expectedRevision, operations } });
  }
  async locate(target,previous) { return this.request('/agent/locate', { method: 'POST', body: { target, ...(previous ? {previous} : {}) } }); }
  async cancel(sessionId) { return this.request('/agent/cancel', { method: 'POST', body: { sessionId } }); }
}

/** Separate desktop discovery keeps the Agent manifest scoped to Agent routes. */
export async function writeDesktopManifest(dir,data) {
  const temporary=join(dir,`.desktop-${randomUUID()}.tmp`);
  try{await writeFile(temporary,JSON.stringify(data),{mode:0o600,flag:'wx'});await rename(temporary,join(dir,'desktop.json'));}
  finally{await rm(temporary,{force:true});}
}
export async function readDesktopManifest(dir) {
  try{
    const path=join(dir,'desktop.json'),s=await lstat(path);
    if(!s.isFile()||s.isSymbolicLink()||s.size>4096||(process.platform!=='win32'&&(s.uid!==process.getuid()||(s.mode&0o077)!==0)))return null;
    const data=JSON.parse(await readFile(path,'utf8'));
    return Number.isInteger(data.port)&&data.port>0&&data.port<65536&&Number.isInteger(data.pid)&&data.pid>0&&/^[a-f0-9]{64}$/.test(data.desktopToken||'')?data:null;
  }catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)return null;throw error;}
}
