/** Real local renderer checks and screenshots. Runs in a disposable runtime. */
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {app} from 'electron';
import {HandoffManager} from '../src/core.mjs';
import {LocalBridge} from '../src/bridge.mjs';
import {savePreferences,loadPreferences} from '../src/local/preferences.mjs';
import {getAccessibilityConsent} from '../src/native/preferences.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,message){for(let i=0;i<100;i++){if(await check())return;await pause(50);}throw Error(message);}
void app.whenReady().then(async()=>{
 const dir=await mkdtemp(join(tmpdir(),'handoffglass-release-ui-')),output=resolve('.tmp/release-ui');
 process.env.HANDOFFGLASS_RUNTIME_DIR=dir;
 process.env.CODEX_HOME=join(dir,'codex');
 app.setPath('home',dir);
 delete process.env.HANDOFFGLASS_ENABLE_ACCESSIBILITY;
 const manager=new HandoffManager(),bridge=new LocalBridge(manager),errors=[];
 let center,setup;
 try{
  await mkdir(output,{recursive:true});await savePreferences({theme:'light',visualStyle:'minimal'},dir);await bridge.start();
  process.env.HANDOFFGLASS_PORT=String(bridge.port);process.env.HANDOFFGLASS_SECRET=bridge.token;
  await import('../src/desktop/main.mjs');await until(()=>bridge.connected,'Desktop did not connect');
  const {showControlCenter}=await import('../src/desktop/center.mjs');center=await showControlCenter();
  center.webContents.on('console-message',(_e,_l,message)=>{if(/Uncaught|Refused to|Failed to load/i.test(message))errors.push(message);});
  center.webContents.on('render-process-gone',(_e,d)=>errors.push(d.reason));
  const js=source=>center.webContents.executeJavaScript(source);
  await until(async()=>await js('document.querySelector("#appVersion").textContent.startsWith("v")'),'Settings did not load');
  async function capture(name){await pause(300);await writeFile(join(output,`${name}.png`),(await center.webContents.capturePage()).toPNG());}
  async function page(name){await js(`document.querySelector('[data-page="${name}"]').click()`);await pause(100);}
  async function set(id,value){await js(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
  await capture('guidance-light');
  await page('connections');await until(async()=>await js('!document.querySelector("#copy").disabled'),'Configuration did not load');
  assert.equal(await js('document.querySelector("#host").value'),'codex');
  assert.equal(await js('document.querySelector(".connection-card details").open'),false);
  assert.ok((await js('document.querySelector("#config").textContent')).includes('[mcp_servers.handoffglass]'));
  assert.equal(await js('document.querySelector("#copy").textContent'),'连接');
  await js('document.querySelector("#copy").click()');
  await until(async()=>await js('document.querySelector("[data-i=\\"connectDesc\\"]").textContent.includes("重启 Codex")'),'Codex connection did not complete');
  assert.match(await readFile(join(dir,'codex','config.toml'),'utf8'),/\[mcp_servers.handoffglass\]/);
  assert.match(await readFile(join(dir,'.agents','skills','visual-handoff','SKILL.md'),'utf8'),/教我清空废纸篓/);
  await capture('connections-light');
  await page('appearance');await until(async()=>await js('document.querySelectorAll("#stylePreview .hg-mark").length===1'),'Shared preview did not render');
  await set('visualStyle','handdrawn');
  assert.equal(await js('document.querySelector("#stylePreview").dataset.style'),'handdrawn');
  assert.equal((await loadPreferences(dir)).visualStyle,'minimal','Unsaved preview changed preferences');
  await js('document.querySelector("#replay").click()');await capture('appearance-light');
  await set('theme','dark');await capture('appearance-dark');
  await set('locale','en-US');await js('document.querySelector("#save").click()');
  await until(async()=>await js('document.documentElement.lang==="en-US"'),'Language did not update');
  assert.equal((await loadPreferences(dir)).visualStyle,'handdrawn');
  assert.equal(await js('document.querySelector("#motion").selectedOptions[0].textContent'),'Gentle');
  await page('diagnostics');assert.equal(await js('document.querySelector(".diagnostics-details").open'),false);
  await js('document.querySelector("#accessibility").click()');
  await until(()=>getAccessibilityConsent({dir,env:{}}),'Permission checkbox did not save');
  await capture('help-dark');
  await set('locale','zh-CN');await page('appearance');await set('theme','light');await js('document.querySelector("#save").click()');
  await until(async()=>await js('document.documentElement.lang==="zh-CN"'),'Locale did not restore');
  center.setSize(740,620);await capture('appearance-small');
  assert.equal(await js('document.documentElement.scrollWidth>innerWidth'),false,'Small window overflowed');
  const {showSetup}=await import('../src/desktop/setup.mjs');setup=await showSetup();
  setup.webContents.on('console-message',(_e,_l,message)=>{if(/Uncaught|Refused to|Failed to load/i.test(message))errors.push(message);});
  await until(async()=>await setup.webContents.executeJavaScript('!document.querySelector("#copy").disabled'),'Setup did not load');
  await writeFile(join(output,'setup.png'),(await setup.webContents.capturePage()).toPNG());
  await setup.webContents.executeJavaScript('document.querySelector("#next").click()');
  assert.equal(await setup.webContents.executeJavaScript('document.querySelector("[data-screen=\\"1\\"]").hidden'),false);
  await setup.webContents.executeJavaScript('document.querySelector("#next").click()');
  await until(async()=>await setup.webContents.executeJavaScript('!document.querySelector("[data-screen=\\"2\\"]").hidden'),'Setup did not save');
  setup.close();setup=null;center.close();center=null;
  const session=manager.show({title:'打开废纸篓',message:'在 Finder 中打开废纸篓，查看其中的文件。',mode:'handoff',timeoutSeconds:120});
  const {BrowserWindow}=await import('electron');
  const panel=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/panel.html'));
  await until(()=>panel.isVisible(),'Decision panel did not appear');await pause(150);
  await writeFile(join(output,'handoff.png'),(await panel.webContents.capturePage()).toPNG());
  assert.equal(await panel.webContents.executeJavaScript('document.querySelector("#note").hidden'),true);
  assert.equal(await panel.webContents.executeJavaScript('document.querySelector("#timer").hidden'),true);
  await panel.webContents.executeJavaScript('document.querySelector("#decline").click()');
  await until(()=>manager.get(session.id).status==='declined','Decline did not reach broker');
  assert.deepEqual(errors,[],'Renderer errors');
  console.log(`PASS release UI: real Codex connection and skill install in disposable home, live preview, preferences, language, permission, collapsed details, narrow window, setup, panel decline. Screenshots: ${output}`);
 }finally{setup?.close();center?.close();manager.close();await bridge.stop();await rm(dir,{recursive:true,force:true});}
}).then(()=>app.exit(0),error=>{console.error(error);app.exit(1);});
