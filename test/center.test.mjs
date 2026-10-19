import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarizeDiagnostics } from '../src/desktop/center-model.mjs';
import { HandoffManager } from '../src/core.mjs';
import { LocalBridge } from '../src/bridge.mjs';

const now=1_000_000;
const state=(patch={})=>({schemaVersion:1,broker:'running',desktopConnected:true,
  lastAgentActivityAt:null,displays:2,pendingPolls:0,handoff:null,...patch});

test('center readout distinguishes a running broker from an authenticated host connection',()=>{
  assert.deepEqual(summarizeDiagnostics(state(),now), {
    broker:'running',desktop:'present',agentActivity:'not_observed',displays:2,
    session:{state:'idle'},hosts:[],timeline:[],observation:'authenticated_tool_call_host_label_unverified'
  });
  assert.equal(summarizeDiagnostics(state({lastAgentActivityAt:now-119999}),now).agentActivity,'recent');
  assert.equal(summarizeDiagnostics(state({lastAgentActivityAt:now-120001}),now).agentActivity,'not_observed');
  assert.equal(summarizeDiagnostics(state({lastAgentActivityAt:now+50}),now).agentActivity,'not_observed');
  assert.equal(summarizeDiagnostics(state({desktopConnected:false}),now).desktop,'reconnecting');
});

test('center readout bounds counters, hides task text and never reports user completion as verification',()=>{
  const result=summarizeDiagnostics(state({displays:10000,secret:'sensitive',handoff:{status:'awaiting_user',
    mode:'handoff',timeoutAt:now+14500,title:'DO NOT LEAK',message:'private'}}),now);
  assert.equal(result.displays,16);
  assert.deepEqual(result.session,{state:'awaiting_user',mode:'handoff',expiresIn:15});
  assert.ok(!JSON.stringify(result).includes('DO NOT LEAK'));
  assert.ok(!JSON.stringify(result).includes('sensitive'));
  assert.throws(()=>summarizeDiagnostics({broker:'offline'},now),/Unavailable/);
});

test('diagnostics endpoint has desktop-only capability and no host identity or private content',async()=>{
  const manager=new HandoffManager();
  const bridge=new LocalBridge(manager);
  await bridge.start();
  const url=`http://127.0.0.1:${bridge.port}/desktop/diagnostics`;
  try {
    const desktop={authorization:`Bearer ${bridge.token}`};
    assert.equal((await fetch(url)).status,401);
    assert.equal((await fetch(url,{headers:{authorization:`Bearer ${bridge.agentToken}`}})).status,401);
    assert.equal((await fetch(url,{method:'POST',headers:desktop})).status,405);
    assert.equal((await fetch(url,{headers:{...desktop,origin:'https://evil.example'}})).status,403);
    const fresh=await (await fetch(url,{headers:desktop})).json();
    assert.equal(fresh.broker,'running');
    assert.equal(fresh.lastAgentActivityAt,null);
    const owner='11111111-1111-4111-8111-111111111111';
    const response=await fetch(`http://127.0.0.1:${bridge.port}/agent/displays`,{headers:{authorization:`Bearer ${bridge.agentToken}`,'x-handoffglass-owner':owner}});
    assert.equal(response.status,200);
    manager.show({title:'Private title',message:'Private text',mode:'handoff'},owner);
    const updated=await (await fetch(url,{headers:desktop})).json();
    assert.ok(updated.lastAgentActivityAt > 0);
    assert.equal(updated.handoff.status,'awaiting_user');
    assert.ok(!JSON.stringify(updated).includes('Private title'));
    assert.ok(!JSON.stringify(updated).includes(owner));
    assert.ok(!JSON.stringify(updated).includes(bridge.agentToken));
  } finally {await bridge.stop();manager.close();}
});

test('desktop control center is a separate sandboxed surface with narrow IPC',async()=>{
  const [entry,preload,html,css,ui]=await Promise.all([
    readFile(new URL('../src/desktop/center.mjs',import.meta.url),'utf8'),
    readFile(new URL('../src/desktop/center-preload.cjs',import.meta.url),'utf8'),
    readFile(new URL('../src/desktop/center.html',import.meta.url),'utf8'),
    readFile(new URL('../src/desktop/center.css',import.meta.url),'utf8'),
    readFile(new URL('../src/desktop/center.js',import.meta.url),'utf8')
  ]);
  assert.match(entry,/sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true/);
  assert.match(entry,/event\.sender === center\.webContents/);
  assert.match(entry,/typeof accessibility!==['"]boolean['"]/);
  assert.match(entry,/HOSTS_SET\.has\(host\)/);
  assert.doesNotMatch(preload,/hg:decision|ipcRenderer\.send\(/);
  assert.match(html,/default-src 'none'/);
  for(const page of ['overview','connections','appearance','diagnostics'])assert.match(html,new RegExp(`data-view="${page}"`));
  assert.match(css,/prefers-reduced-motion/);
  assert.match(ui,/textContent/);
  assert.match(html,/id=\"hostEvidence\"/);
  assert.match(ui,/config_declared|observedHosts/);
  assert.doesNotMatch(ui,/innerHTML\s*=/);
});
