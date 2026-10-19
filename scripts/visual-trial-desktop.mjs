/** Real Electron/MCP trial; only the disposable fixture is scripted in --smoke. */
import assert from 'node:assert/strict';
import {app,BrowserWindow,ipcMain,screen} from 'electron';
import {mkdtempSync} from 'node:fs';
import {mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {HandoffManager} from '../src/core.mjs';
import {LocalBridge} from '../src/bridge.mjs';
import {writeManifest} from '../src/runtime.mjs';
import {savePreferences} from '../src/local/preferences.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dir=mkdtempSync(join(tmpdir(),'handoffglass-visual-'));
app.setPath('userData',join(dir,'electron'));
process.env.HANDOFFGLASS_RUNTIME_DIR=dir;
const smoke=process.argv.includes('--smoke');
const outArg=process.argv.find(a=>a.startsWith('--output='));
const output=outArg?resolve(outArg.slice(9)):null;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,message){for(let i=0;i<150;i++){const value=await check();if(value)return value;await pause(40);}throw new Error(message);}
const presets=[
 {shape:'scribble',style:'handdrawn',effect:'draw',name:'手绘双圈',color:'#568e68'},
 {shape:'arrow',style:'minimal',effect:'flow',name:'流动箭头',color:'#6b98c4'},
 {shape:'highlight',style:'handdrawn',effect:'draw',name:'荧光笔记',color:'#d6a74f'},
 {shape:'spotlight',style:'luminous',effect:'draw',name:'柔边聚焦',color:'#82d5ac'},
 {shape:'bracket',style:'minimal',effect:'pulse',name:'四角强调',color:'#ac8dcd'},
 {shape:'halo',style:'luminous',effect:'pulse',name:'呼吸落点',color:'#7dc4aa'}
];
void app.whenReady().then(async()=>{
 const manager=new HandoffManager(),bridge=new LocalBridge(manager),client=new Client({name:'codex-visual-trial',version:'0.15.0'});
 let win,active,preset=0,chain=Promise.resolve(),closing=false,moveTimer;
 const report={mode:smoke?'synthetic_fixture':'human_interactive',presets:[],calls:0};
 async function invoke(name,args={}){
  report.calls++;const result=await client.callTool({name,arguments:args});
  assert.ok(!result.isError,result.content?.map(c=>c.text||'').join('; '));
  return JSON.parse(result.content.find(c=>c.type==='text').text);
 }
 const state=value=>{if(win&&!win.isDestroyed())win.webContents.send('hg:trial:state',value);};
 function enqueue(fn){const pending=chain.then(fn);chain=pending.catch(error=>{console.error(error);state({message:`试用错误：${error.message}`});});return pending;}
 const overlays=()=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().endsWith('/overlay.html'));
 async function scene(){
  const measured=await win.webContents.executeJavaScript(`Object.fromEntries(['open','updated','file'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id,{x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height}]}))`);
  const b=win.getContentBounds(),p=presets[preset],t=measured[p.shape==='highlight'?'updated':p.shape==='bracket'?'file':'open'];
  return {version:1,layers:[{id:'guide',annotations:[{id:'target',...t,x:t.x+b.x,y:t.y+b.y,shape:p.shape,color:p.color,effect:p.effect,durationMs:1000,
   label:p.shape==='highlight'?'先留意更新时间':p.shape==='bracket'?'确认这份项目文件':'打开项目，继续创作'}]}]};
 }
 async function show(index=preset){
  if(closing)return;
  if(active?.mode==='handoff'&&active.status==='awaiting_user'){
   state({message:'当前正在交接。请先在 HandoffGlass 面板完成、拒绝或取消，然后再试另一种笔触。'});return;
  }
  if(active?.mode==='handoff')await win.webContents.executeJavaScript('dispatchEvent(new Event("hg-trial-reset"))');
  if(active)await invoke('handoff_cancel',{sessionId:active.id});
  preset=index;
  // Preferences belong only to this disposable fixture, never the user's profile.
  await savePreferences({visualStyle:presets[preset].style,motion:'expressive'},dir);
  active=(await invoke('visual_show',{title:presets[preset].name,message:'请在演示窗口中打开项目',scene:await scene(),timeoutSeconds:600})).session;
  state({preset,message:`${presets[preset].name} · 拖动窗口可观察跟随，点击「打开项目」进入交接`,phase:'AGENT → HANDOFFGLASS → YOU'});
 }
 async function follow(){
  if(closing||!active||active.status!=='awaiting_user')return;
  const next=await scene();
  active=(await invoke('visual_scene_update',{sessionId:active.id,expectedRevision:active.sceneRevision,
   operations:[{op:'upsert_layer',layer:next.layers[0]}]})).session;
 }
 async function opened(){
  const actual=await win.webContents.executeJavaScript('document.body.dataset.opened === "true"');
  assert.equal(actual,true,'Original application state must change before the handoff');
  if(active)await invoke('handoff_cancel',{sessionId:active.id});
  active=(await invoke('handoff_request',{title:'把工作交回 Agent',message:'演示项目已经打开。请核对原始窗口，然后点击「我已完成」。Agent 会独立读取项目状态。',
   scene:await scene(),timeoutSeconds:600})).session;
  state({message:'项目已打开。请在 HandoffGlass 交接面板中点击「我已完成」。',phase:'YOU → HANDOFFGLASS → AGENT'});
 }
 async function verifyDecision(){
  if(!active||active.mode!=='handoff')return false;
  const result=await invoke('handoff_wait',{sessionId:active.id,maxWaitSeconds:0});
  if(result.session.status==='awaiting_user')return false;
  active=result.session;
  const opened=await win.webContents.executeJavaScript('document.body.dataset.opened === "true"');
  const events=await invoke('handoff_events',{sessionId:active.id});
  report.result={status:active.status,completionSource:active.completionSource,verified:active.verified,applicationOpened:opened,events:events.events.map(e=>e.type)};
  state({message:active.status==='completed'&&opened?'交接成功 · Agent 已独立核对：原始项目处于打开状态。':`交接状态：${active.status} · Agent 已停止等待`,phase:'AGENT RESUMED · ORIGINAL STATE CHECKED'});
  console.log(JSON.stringify(report,null,2));
  if(output)await writeFile(join(output,'trial-result.json'),JSON.stringify(report,null,2)+'\n');
  return true;
 }
 let decisionTimer;
 try{
  if(output)await mkdir(output,{recursive:true});
  await savePreferences({visualStyle:'handdrawn',motion:'expressive'},dir);
  await bridge.start();await writeManifest(dir,{port:bridge.port,token:bridge.agentToken,pid:process.pid,startedAt:Date.now(),protocol:1});
  process.env.HANDOFFGLASS_PORT=String(bridge.port);process.env.HANDOFFGLASS_SECRET=bridge.token;
  await import('../src/desktop/main.mjs');
  await until(()=>bridge.connected,'Desktop did not attach');
  const agentEnv={...process.env,HANDOFFGLASS_OUTPUT:'full',HANDOFFGLASS_HOST_ID:'codex',HANDOFFGLASS_HEADLESS:'0'};
  delete agentEnv.HANDOFFGLASS_SECRET;delete agentEnv.HANDOFFGLASS_PORT;
  await client.connect(new StdioClientTransport({command:process.env.HANDOFFGLASS_TRIAL_NODE,args:[join(root,'src/mcp.mjs')],
   env:agentEnv,stderr:'pipe'}));
  const displays=await invoke('screen_displays');assert.equal(displays.connected,true);
  win=new BrowserWindow({width:1060,height:790,minWidth:900,minHeight:760,title:'HandoffGlass · Agent 试用',
   webPreferences:{preload:join(root,'scripts/visual-trial-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  await win.loadFile(join(root,'examples/agent-trial.html'));win.center();win.show();app.focus({steal:true});win.focus();
  ipcMain.handle('hg:trial:action',(event,name,value)=>{
   if(event.sender!==win.webContents)return {ok:false};
   return enqueue(async()=>{
    if(name==='preset'&&Number.isInteger(value)&&value>=0&&value<presets.length)await show(value);
    else if(name==='replay')await show();
    else if(name==='opened')await opened();
    return {ok:true};
   });
  });
  for(const event of ['move','resize'])win.on(event,()=>{clearTimeout(moveTimer);moveTimer=setTimeout(()=>void enqueue(follow),120);});
  if(smoke)await until(()=>win.isFocused(),'Fixture did not receive focus. Unlock the desktop and keep the trial window in front.');
  await show();
  if(smoke){
   await runVisualChecks({win,overlays,show,follow,invoke,active:()=>active,scene,presets,report,output,pause,until});
   await win.webContents.executeJavaScript('document.getElementById("open").click()');
   await until(()=>active?.mode==='handoff','Original button did not start a handoff');await chain;
   const panel=await until(()=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/panel.html')&&w.isVisible()),'Decision panel did not appear');
   await until(()=>panel.webContents.executeJavaScript('!document.getElementById("done").disabled'),'Decision panel did not become interactive');
   await panel.webContents.executeJavaScript('document.getElementById("done").click()');
   await until(verifyDecision,'Decision did not return over MCP');
   assert.deepEqual({...report.result,events:undefined},{status:'completed',completionSource:'user_report',verified:false,applicationOpened:true,events:undefined});
   assert.ok(report.result.events.includes('completed'));
   console.log('PASS real desktop visual trial: six presets, continuous motion, live scene patches, reduced motion, MCP/decision/state verification (fixture actions synthetic)');
  }else{
   console.log('Agent 试用已启动：切换笔触、拖动窗口，点击「打开项目」，再在交接面板点「我已完成」。关闭试用窗口结束。');
   decisionTimer=setInterval(()=>{if(active?.mode==='handoff'&&active.status==='awaiting_user')void enqueue(verifyDecision);},700);
   await new Promise(resolve=>win.once('closed',resolve));
  }
 }finally{
  closing=true;clearTimeout(moveTimer);clearInterval(decisionTimer);await chain;
  if(active)await invoke('handoff_cancel',{sessionId:active.id}).catch(()=>{});
  await client.close().catch(()=>{});manager.close();await bridge.stop();
  await rm(dir,{recursive:true,force:true,maxRetries:8,retryDelay:100});
 }
}).then(()=>app.exit(0),error=>{console.error(error);app.exit(1);});

async function runVisualChecks(ctx){
 const {win,overlays,show,follow,invoke,active,scene,presets,report,output,pause,until}=ctx;
 const overlay=await until(()=>overlays().find(w=>w.isVisible()),'No production overlay');
 const js=source=>overlay.webContents.executeJavaScript(source);
 for(let i=0;i<presets.length;i++){
  if(i)await show(i);
  await until(()=>js(`document.querySelector('.hg-mark')?.dataset.shape === '${presets[i].shape}'`),'Preset not drawn');
  if(i===0){
   await pause(100);const first=await js(`getComputedStyle(document.querySelector('.hg-trace')).strokeDashoffset`);
   await pause(220);const second=await js(`getComputedStyle(document.querySelector('.hg-trace')).strokeDashoffset`);
   assert.ok(parseFloat(first)>parseFloat(second)&&parseFloat(second)>0,`Stroke must actually draw: ${first} → ${second}`);
   await js('window.originalMark=document.querySelector(".hg-mark")');
   await follow();await pause(100);
   assert.equal(await js('window.originalMark===document.querySelector(".hg-mark")'),true,'Unchanged snapshots must keep the animated DOM node');
   report.strokeProgress=[parseFloat(first),parseFloat(second)];
  }
  await pause(1200);
  assert.ok(win.isFocused(),'Guide presentation stole focus from the fixture');
  assert.equal(await js('document.querySelector(".hg-mark").getAttribute("opacity")'),'1');
  if(output)await composite(win,overlay,join(output,`desktop-${presets[i].shape}.png`));
  report.presets.push(presets[i].shape);
 }
 // Production hidden windows must clear playback state before target restoration.
 let hidden=await invoke('visual_scene_update',{sessionId:active().id,expectedRevision:active().sceneRevision,
  operations:[{op:'set_layer',layerId:'guide',visible:false}]});
 Object.assign(active(),hidden.session);
 await until(()=>js('document.querySelectorAll(".hg-mark").length === 0'),'Lost target did not clear the hidden renderer');
 const restored=await invoke('visual_scene_update',{sessionId:active().id,expectedRevision:active().sceneRevision,
  operations:[{op:'set_layer',layerId:'guide',visible:true}]});
 Object.assign(active(),restored.session);
 await until(()=>js('document.querySelectorAll(".hg-mark").length === 1'),'Target restoration did not redraw');
 assert.equal(await js('parseFloat(document.querySelector(".hg-mark").style.getPropertyValue("--hg-delay"))'),0);
 // The fixture sends measured global DIP coordinates after actual window movement.
 await show(0);await pause(1200);
 const before=active().annotations[0];const bounds=win.getBounds(),area=screen.getPrimaryDisplay().workArea;
 const dx=bounds.x+80+bounds.width<=area.x+area.width?80:-80;
 const started=performance.now();win.setPosition(bounds.x+dx,bounds.y);
 await until(()=>Math.abs(active().annotations[0].x-before.x-dx)<.1,'Moved fixture was not tracked');
 report.moveLatencyMs=Math.round(performance.now()-started);
 const markDelay=await js('parseFloat(document.querySelector(".hg-mark").style.getPropertyValue("--hg-delay"))');
 assert.ok(markDelay<=-1000,'Moved marks must not replay their arrival');
 overlay.webContents.debugger.attach('1.3');
 await overlay.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await show(0);await pause(120);
 assert.equal(await js('getComputedStyle(document.querySelector(".hg-trace")).animationName'),'none');
 assert.equal(parseFloat(await js('getComputedStyle(document.querySelector(".hg-trace")).strokeDashoffset')),0);
 await overlay.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 overlay.webContents.debugger.detach();
 // Repeated owner-scoped updates exercise node preservation and bound response costs.
 app.focus({steal:true});win.focus();await until(()=>win.isFocused(),'Fixture did not receive focus before patch check');
 const timings=[];
 for(let i=0;i<24;i++){const t=performance.now();const s=active();await invoke('visual_scene_update',{sessionId:s.id,expectedRevision:s.sceneRevision,operations:[{op:'upsert_layer',layer:(await scene()).layers[0]}]}).then(r=>Object.assign(s,r.session));timings.push(performance.now()-t);}
 timings.sort((a,b)=>a-b);report.patchMs={count:timings.length,p50:Math.round(timings[11]),p95:Math.round(timings[22])};
 assert.equal(win.isFocused(),true,'Overlay must retain target focus');
 assert.equal(overlay.isFocusable(),false);
}
async function composite(win,overlay,path){
 const b=win.getContentBounds(),o=overlay.getBounds();
 const base=(await win.webContents.capturePage()).toDataURL();
 const top=(await overlay.webContents.capturePage({x:b.x-o.x,y:b.y-o.y,width:b.width,height:b.height})).toDataURL();
 const compositor=new BrowserWindow({show:false,focusable:false,skipTaskbar:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 try{
  await compositor.loadURL('data:text/html,<canvas></canvas>');
  const data=await compositor.webContents.executeJavaScript(`(async()=>{const imgs=await Promise.all(${JSON.stringify([base,top])}.map(src=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=src})));const c=document.querySelector('canvas');c.width=imgs[0].width;c.height=imgs[0].height;const ctx=c.getContext('2d');imgs.forEach(i=>ctx.drawImage(i,0,0,c.width,c.height));return c.toDataURL('image/png').split(',')[1]})()`);
  await writeFile(path,Buffer.from(data,'base64'));
 }finally{compositor.destroy();}
}
