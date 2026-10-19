/** Isolated real stdio-MCP smoke for the *local executable*, not host registration.
 * No host config write, no sensitive task content, no desktop interaction.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readManifest } from '../runtime.mjs';

export const REQUIRED_TOOLS = Object.freeze(['screen_displays','visual_show','handoff_request','handoff_status','handoff_wait','handoff_cancel']);
const MAX_OUTPUT = 256 * 1024;
const nap = ms => new Promise(resolve => setTimeout(resolve,ms));

export function classifyMcpFailure(phase, reason) {
  const code = reason === 'timeout' ? 'timeout'
    : reason === 'missing_tools' ? 'missing_tools'
    : reason === 'bad_response' ? 'protocol_mismatch'
    : reason === 'launch_failed' ? 'launch_failed'
    : reason === 'process_exited' ? 'process_exited' : 'handshake_failed';
  return Object.freeze({ok:false,code,phase,hostVerified:false});
}

/** A small JSON-RPC-over-stdio driver. Handles arbitrary stdout chunks, IDs, and size bounds. */
export class RpcLines {
  #buffer = '';
  #pending = new Map();
  #next = 1;
  #write;
  #closed = null;
  constructor(write) { if (typeof write !== 'function') throw new TypeError('write must be a function'); this.#write = write; }
  receive(chunk) {
    if (this.#closed) return;
    this.#buffer += chunk.toString('utf8');
    if (this.#buffer.length > MAX_OUTPUT) {this.close(new Error('bad_response'));return;}
    let offset;
    while ((offset=this.#buffer.indexOf('\n'))!==-1) {
      const line=this.#buffer.slice(0,offset).trim();this.#buffer=this.#buffer.slice(offset+1);
      if (!line) continue;
      let parsed;
      try { parsed=JSON.parse(line); } catch {this.close(new Error('bad_response'));return;}
      if (!Number.isInteger(parsed.id)) continue; // notifications do not resolve requests
      const pending=this.#pending.get(parsed.id);
      if (!pending) continue;
      this.#pending.delete(parsed.id);
      if (parsed.error || !Object.prototype.hasOwnProperty.call(parsed,'result')) pending.reject(new Error('bad_response'));
      else pending.resolve(parsed.result);
    }
  }
  request(method,params={}) {
    if (this.#closed) return Promise.reject(this.#closed);
    const id=this.#next++;
    return new Promise((resolve,reject)=>{
      this.#pending.set(id,{resolve,reject});
      try {this.#write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');}
      catch {this.#pending.delete(id);reject(new Error('launch_failed'));}
    });
  }
  notify(method) {if (this.#closed) throw this.#closed;this.#write(JSON.stringify({jsonrpc:'2.0',method})+'\n');}
  close(error=new Error('process_exited')) {if(this.#closed)return;this.#closed=error;for(const p of this.#pending.values())p.reject(error);this.#pending.clear();}
}

/** Injected process factory lets tests verify protocol behavior without invoking a real app. */
export async function checkLocalMcp({command,entry,env=process.env,timeoutMs=16000,spawnProcess=spawn,
  inspectDisplays=true}={}) {
  if(typeof command!=='string'||!command||typeof entry!=='string'||!entry)
    return classifyMcpFailure('setup','launch_failed');
  if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>60000)throw new RangeError('Invalid test timeout');
  const dir=await mkdtemp(join(tmpdir(),'hg-selftest-'));
  let child,parser,phase='launch',timer;
  try {
    const childEnv={...env,HANDOFFGLASS_RUNTIME_DIR:dir,HANDOFFGLASS_HEADLESS:'1',
      HANDOFFGLASS_EXTRAS:'0',HANDOFFGLASS_ENABLE_ACCESSIBILITY:'0'};
    child=spawnProcess(command,[entry],{env:childEnv,stdio:['pipe','pipe','ignore'],windowsHide:true});
    parser=new RpcLines(line=>{if(!child.stdin.writable)throw Error('launch_failed');child.stdin.write(line);});
    child.stdout.on('data',data=>parser.receive(data));
    child.once('error',()=>parser.close(new Error('launch_failed')));
    child.once('exit',()=>parser.close(new Error('process_exited')));
    const timeout=new Promise((_,reject)=>{
      timer=setTimeout(()=>{parser.close(new Error('timeout'));reject(new Error('timeout'));},timeoutMs);
    });
    const transaction=(async()=>{
      phase='initialize';
      const initialization=await parser.request('initialize',{
        protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'handoffglass-local-selftest',version:'1.0.0'}
      });
      if(!initialization || !initialization.serverInfo || !initialization.protocolVersion)throw Error('bad_response');
      parser.notify('notifications/initialized');
      phase='tools';
      const discovered=await parser.request('tools/list',{});
      if(!Array.isArray(discovered?.tools))throw Error('bad_response');
      const found=new Set(discovered.tools.map(t=>t.name));
      if(!REQUIRED_TOOLS.every(t=>found.has(t)))throw Error('missing_tools');
      if(inspectDisplays){
        phase='headless_display';
        const display=await parser.request('tools/call',{name:'screen_displays',arguments:{}});
        if(display?.isError || !Array.isArray(display?.content) || !display.content.some(c=>c.type==='text'))
          throw Error('bad_response');
      }
      return {ok:true,code:'passed',phase:'complete',toolCount:found.size,
        headless:inspectDisplays,hostVerified:false};
    })();
    return await Promise.race([transaction,timeout]);
  } catch(error) {return classifyMcpFailure(phase,error.message);} finally {
    clearTimeout(timer);
    parser?.close();
    if(child){
      try {child.stdin.end();} catch {}
      try {child.kill();} catch {}
    }
    // The isolated headless screen query can spawn a broker. Stop only its own PID.
    try {const broker=await readManifest(dir);if(broker){try{process.kill(broker.pid,'SIGTERM');}catch{}}}catch{}
    for(let i=0;i<5;i++){
      try {await rm(dir,{recursive:true,force:true,maxRetries:8,retryDelay:120});break;}
      catch(error){if(i===4)break;await nap(160*(i+1));}
    }
  }
}
