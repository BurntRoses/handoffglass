/** Codex lifecycle bridge. Reads only hook envelopes; never reads transcripts. */
import {createHash, randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {rm} from 'node:fs/promises';
import {runtimeDir, readManifest, secureRuntimeDir} from '../runtime.mjs';
import {readManagedFile, compareWrite} from '../managed-files.mjs';
import {capabilityInstructions} from '../capabilities.mjs';

const terminal = new Set(['completed','declined','cancelled','expired','superseded']);
const uuid = /^[a-f0-9]{8}-[a-f0-9-]{27,}$/;
const token = /^[a-f0-9]{64}$/;
const hash = text => createHash('sha256').update(text).digest('hex');
const id = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const context = (hook, text) => ({hookSpecificOutput:{hookEventName:hook,additionalContext:text}});
export const codexHookDirectory = (env=process.env) => join(runtimeDir(env),'plugins','codex',hash(env.CODEX_HOME||join(homedir(),'.codex')));
export const hostHookDirectory = (host,env=process.env) => host==='codex'?codexHookDirectory(env):join(runtimeDir(env),'plugins','claude-code',hash(env.CLAUDE_CONFIG_DIR||join(homedir(),'.claude')));

function toolResult(value) {
  if (!value || typeof value !== 'object' || value.isError) return null;
  if (value.structuredContent) return value.structuredContent;
  for (const item of value.content || []) if (item.type === 'text') {
    try { const parsed=JSON.parse(item.text);if(parsed?.session)return parsed; } catch { /* Non-JSON tool text. */ }
  }
  return value.session ? value : null;
}

export async function requestCodexHook(env, state, event, phase) {
  // Hooks never start a Broker, UI, or model on unrelated activity.
  const live=await readManifest(runtimeDir(env));if(!live)return null;
  const response=await fetch(`http://127.0.0.1:${live.port}/agent/plugin-hook`,{
    method:'POST',headers:{authorization:`Bearer ${live.token}`,'content-type':'application/json',
      'x-handoffglass-owner':randomUUID(),'x-handoffglass-host':env.HANDOFFGLASS_HOST_ID==='claude-code'?'claude-code':'codex'},
    body:JSON.stringify({sessionId:state.id,resumeToken:state.resumeToken,hostSession:state.hostSession,event,phase,expectedStep:state.step}),
    signal:AbortSignal.timeout(650)
  });
  if(!response.ok)return null;
  return response.json();
}

export async function handleCodexHook(input, {env=process.env, request=requestCodexHook,host='codex'}={}) {
  if(!['codex','claude-code'].includes(host))return {};
  const event=input?.hook_event_name;
  if(!id(input?.session_id))return {};
  if(event==='SessionStart')return context(event,capabilityInstructions()+
    ' Plugin hooks sync phases and offer one bounded continuation reminder; an idle turn cannot be awakened. Use the bundled visual-handoff Skill; do not install another MCP entry.');
  const events=['PostToolUse','PreToolUse','PreModelRequest','Stop','Interrupt','SessionEnd'];
  if(!events.includes(event))return {};
  const root=hostHookDirectory(host,env),hostSession=hash(input.session_id),path=join(root,hostSession+'.json');
  let prior=await readManagedFile(path),state;
  if(prior)try{state=JSON.parse(prior);}catch{return {};}
  if(state && (state.hostSession!==hostSession || !uuid.test(state.id)||!token.test(state.resumeToken)))return {};
  const name=typeof input.tool_name==='string'?input.tool_name:'';
  if(event==='PostToolUse' && /^mcp__[^\s]*handoffglass[^\s]*__session_(start|present|resume|wait|verify|stop|control|update)$/.test(name)) {
    const result=toolResult(input.tool_response),session=result?.session;
    if(!session || !uuid.test(session.id||''))return {};
    if(terminal.has(session.status)) {if(state?.id===session.id)await rm(path,{force:true});return {};}
    // Only a start/resume result may establish or rotate the binding proof.
    const fresh=/(?:__session_start|__session_resume)$/.test(name) && token.test(result.resumeToken||'');
    if(!fresh && state?.id!==session.id)return {};
    if(fresh && state?.id!==session.id)state=null;
    const next={id:session.id,resumeToken:fresh?result.resumeToken:state.resumeToken,hostSession,
      execution:session.execution||'attached',step:session.step||1,updatedAt:Date.now(),...(state?.reminder?{reminder:state.reminder}:{})};
    await secureRuntimeDir(root);
    await compareWrite({path,prior,next:JSON.stringify(next)});state=next;prior=JSON.stringify(next);
    await request(env,state,'bind');return {};
  }
  if(!state)return {};
  if(Date.now()-state.updatedAt>86400000){await rm(path,{force:true});return {};}
  if(event==='Interrupt'||event==='SessionEnd') {
    await request(env,state,event==='Interrupt'?'interrupt':'end');
    if(event==='SessionEnd')await rm(path,{force:true});return {};
  }
  if(state.execution==='parked' && !['Interrupt','SessionEnd'].includes(event))return {};
  if(event==='Stop') {
    if(input.stop_hook_active===true)return {};
    const current=await request(env,state,'status');
    if(!current?.session || terminal.has(current.session.status)||current.session.status==='paused'||current.session.execution==='parked')return {};
    const s=current.session,key=`${s.step}:${s.phase}:${s.nextAction}`;
    if(state.reminder===key)return {};
    state.reminder=key;await compareWrite({path,prior,next:JSON.stringify(state)});
    return {decision:'block',reason:`HandoffGlass session ${state.id}, step ${s.step}, remains active (${s.nextAction}). Continue this owned workflow: wait with session_wait and its saved cursor, or independently inspect and verify when due. Do not repeat the card in chat. Respect stop, pause and refusal; do not create a new session or loop on empty waits.`};
  }
  const phases={ui_inspect:'observing',ui_locate:'locating',session_start:'presenting',session_present:'presenting',session_update:'presenting',session_verify:'verifying'};
  const tool=name.split('__').at(-1);
  const phase=event==='PreModelRequest'?'thinking':phases[tool];
  if(phase && (event==='PreModelRequest'||name.includes('handoffglass')))await request(env,state,'progress',phase);
  return {};
}

export async function runCodexHook({env=process.env,stdin=process.stdin,stdout=process.stdout}={}) {
  try {
    let text='';for await(const chunk of stdin){text+=chunk;if(Buffer.byteLength(text)>262144)return;}
    const output=await handleCodexHook(JSON.parse(text||'{}'),{env});
    stdout.write(JSON.stringify(output)+'\n');
  } catch { stdout.write('{}\n'); } // Advisory hooks must not break unrelated tasks.
}
