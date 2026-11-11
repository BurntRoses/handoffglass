/** Real Chromium checks for layout, state, copy, three locales and optional baseline comparison. */
import assert from 'node:assert/strict';
import {assertPalette,assertNoHorizontalOverflow} from './ui-design-assertions.mjs';
import {app,BrowserWindow,nativeImage} from 'electron';
import {mkdtempSync} from 'node:fs';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {startSitePreview} from './site-preview.mjs';
import {startDemo} from '../demo/server.mjs';
const profile=mkdtempSync(join(tmpdir(),'hg-site-'));app.setPath('userData',profile);
app.on('window-all-closed',()=>{});
const baseline=process.argv.includes('--baseline'),compare=process.argv.includes('--compare');
const output=resolve('.tmp/site-qa'),before=join(output,'before'),after=join(output,'after');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const metrics={},errors=[];
void app.whenReady().then(async()=>{
 const rootArgument=process.argv.find(a=>a.startsWith('--root='));
 const server=await startSitePreview(rootArgument?{root:resolve(rootArgument.slice(7))}:{});let win;
 try{
  await mkdir(baseline?before:after,{recursive:true});
  win=new BrowserWindow({show:false,width:1440,height:1000,useContentSize:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  win.webContents.debugger.attach('1.3');
  win.webContents.on('console-message',event=>{if(/Uncaught|Refused|Failed to load/i.test(event.message))errors.push(event.message);});
  const js=source=>win.webContents.executeJavaScript(source);
  const base=`http://127.0.0.1:${server.address().port}/site/`;
  async function settle(){
   await js(`(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));for(const a of document.getAnimations()){a.pause();a.currentTime=5000;}await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);
  }
  async function record(key){
   await settle();
   await assertNoHorizontalOverflow(win.webContents,key);
   await assertPalette(win.webContents);
   const snapshot=await js(`(()=>{
    const elements=[...document.body.querySelectorAll('*')];
    const props=['display','position','width','height','padding','font','color','background','border','boxShadow','filter','backdropFilter','opacity','transform','overflow','clipPath','stroke','strokeDasharray','strokeDashoffset','animationName','animationDuration','animationDelay','animationTimingFunction','animationFillMode','transition','outline','boxSizing'];
    return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,lang:document.documentElement.lang,title:document.title,
     elements:elements.map(el=>{const b=el.getBoundingClientRect(),s=getComputedStyle(el);return {tag:el.tagName,text:el.children.length?null:el.textContent,rect:[b.x,b.y,b.width,b.height],styles:Object.fromEntries(props.map(k=>[k,s[k]]))};})};})()`);
   const dimensions=await js('({width:innerWidth,height:document.documentElement.scrollHeight})');
   const capture=await win.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,...dimensions,scale:1}});
   const image=nativeImage.createFromBuffer(Buffer.from(capture.data,'base64'));
   const destination=join(baseline?before:after,key);
   await writeFile(destination+'.json',JSON.stringify(snapshot));await writeFile(destination+'.png',image.toPNG());
   if(compare&&!baseline){
    const prior=JSON.parse(await readFile(join(before,key+'.json'),'utf8'));
    // Chromium can serialize logical auto margins differently with identical used geometry.
    // Rectangles and full-page pixels cover their actual layout.
    for(const element of prior.elements)delete element.styles.margin;
    assert.deepEqual(snapshot,prior,`${key}: layout, text or computed motion changed`);
    const original=nativeImage.createFromBuffer(await readFile(join(before,key+'.png')));
    assert.deepEqual(image.getSize(),original.getSize());
    const a=nativeImage.createFromBuffer(image.toPNG()).toBitmap(),b=original.toBitmap();let changed=0;
    for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])changed++;
    assert.equal(changed,0,`${key}: ${changed} rendered pixels changed`);
   }
  }
  for(const page of ['index','getting-started']){
   for(const [label,width,height] of [['desktop',1440,1000],['tablet',820,1100],['mobile',390,844]]){
    win.setContentSize(width,height);
    for(const lang of ['en','zh','ja']){
     await win.loadURL(`${base}${page}.html?lang=${lang}`);await pause(80);await settle();
     assert.equal(await js('document.documentElement.lang'),lang==='zh'?'zh-CN':lang);
     await record(`${page}-${label}-${lang}`);
    }
   }
  }
  win.setContentSize(1440,1000);
  await win.loadURL(base+'index.html?lang=en');await pause(80);
  for(const scene of ['focus','sequence','caution']){
   await js(`document.querySelector('[data-scenario=${scene}]').click()`);await record(`scene-${scene}`);
  }
  for(const outcome of ['complete','decline']){
   await js(`document.querySelector('[data-scenario=focus]').click();document.getElementById('${outcome}').click()`);
   await record(`outcome-${outcome}`);
   await js(`document.querySelector('[data-lang=zh]').click()`);
   assert.equal(await js('document.querySelector(".experience-stage").dataset.outcome'),outcome);
   assert.ok((await js('document.querySelector(".handoff-title").textContent')).includes(outcome==='complete'?'完成':'拒绝'));
   await js(`document.querySelector('[data-lang=en]').click()`);
  }
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await win.loadURL(base+'index.html?lang=en');await pause(80);await record('reduced-motion');
  assert.equal(await js('getComputedStyle(document.querySelector(".ink-path")).animationName'),'none');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await win.webContents.debugger.sendCommand('Performance.enable');
  for(const page of ['index','getting-started']){
   await win.loadURL(base+page+'.html?lang=en');await pause(100);
   await js('localStorage.clear()');
   const selector=page==='index'?'#copy-command':'#copyCode';
   // Simulate a denied modern clipboard: fallback must copy and return focus.
   await js(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied')}}});document.execCommand=command=>{window.copiedFallback={command,text:document.activeElement.value};return true;};document.querySelector('${selector}').focus();document.querySelector('${selector}').click()`);
   await pause(60);assert.ok((await js('window.copiedFallback.text')).includes('https://github.com/BurntRoses/handoffglass'));
   assert.equal(await js('window.copiedFallback.command'),'copy');
   assert.match(await js(`document.querySelector('${selector}').textContent`),/Copied/);
   if(!baseline)assert.equal(await js(`document.activeElement===document.querySelector('${selector}')`),true,'Fallback lost copy-button focus');
   await js(`document.querySelector('[data-lang=ja]').click()`);
   await pause(30);assert.match(await js(`document.querySelector('${selector}').textContent`),/コピー/);
   const m=(await win.webContents.debugger.sendCommand('Performance.getMetrics')).metrics;
   const start=Object.fromEntries(m.map(x=>[x.name,x.value]));
   const repeat=await js(`(()=>{const mutations=new MutationObserver(()=>{});mutations.observe(document.body,{subtree:true,childList:true,attributes:true});const t=performance.now();for(let i=0;i<120;i++)document.querySelector('[data-lang=ja]').click();const ms=performance.now()-t,count=mutations.takeRecords().length;mutations.disconnect();return {ms,mutations:count};})()`);
   const end=Object.fromEntries((await win.webContents.debugger.sendCommand('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
   metrics[page]={repeatLocaleMs:repeat.ms,repeatLocaleMutations:repeat.mutations,recalcStyle:end.RecalcStyleCount-start.RecalcStyleCount,layout:end.LayoutCount-start.LayoutCount,
    resources:await js(`performance.getEntriesByType('resource').filter(r=>new URL(r.name).origin===location.origin).map(r=>({path:new URL(r.name).pathname,bytes:r.decodedBodySize}))`)};
   if(!baseline){
    assert.equal(repeat.mutations,0,'Selecting the current locale must not rewrite the page');
    if(page==='getting-started')assert.equal(metrics[page].resources.some(r=>/\/(style\.css|translations\.mjs)$/.test(r.path)),false,'Guide loaded home-only assets');
   }
   await win.loadURL(base+page+'.html');await pause(80);assert.equal(await js('document.documentElement.lang'),'ja');
  }
  if(!baseline){
   // Slow modern clipboard, double-click, locale change and denied fallback.
   for(const page of ['index','getting-started']){
    await win.loadURL(base+page+'.html?lang=en');await pause(80);
    const selector=page==='index'?'#copy-command':'#copyCode';
    await js(`window.copyCalls=0;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>{copyCalls++;return new Promise(r=>window.finishCopy=r)}}});document.querySelector('${selector}').focus();document.querySelector('${selector}').click();document.querySelector('${selector}').click()`);
    assert.equal(await js('copyCalls'),1,'Parallel clipboard writes were not coalesced');
    await js(`document.querySelector('[data-lang=zh]').click();finishCopy()`);await pause(30);
    assert.equal(await js(`document.querySelector('${selector}').textContent.trim()`),'复制','Delayed copy completion overwrote the new language');
    await js(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied')}}});document.execCommand=()=>false;document.querySelector('${selector}').focus();document.querySelector('${selector}').click()`);await pause(30);
    assert.equal(await js('document.querySelectorAll("textarea").length'),0,'Failed fallback leaked a node');
    assert.equal(await js(`document.activeElement===document.querySelector('${selector}')`),true);
    assert.equal(await js(`document.querySelector('${selector}').textContent.trim()`),'复制','Failed copy reported success');
    // Ten copies still leave a single reset listener.
    await js(`document.execCommand=()=>true;void 0`);
    for(let i=0;i<10;i++){await js(`document.querySelector('${selector}').click()`);await pause(2);}
    const remote=await win.webContents.debugger.sendCommand('Runtime.evaluate',{expression:`document.querySelector('${selector}')`});
    const {listeners}=await win.webContents.debugger.sendCommand('DOMDebugger.getEventListeners',{objectId:remote.result.objectId});
    assert.equal(listeners.filter(l=>l.type==='blur').length,1,'Copies accumulated reset listeners');
   }
   // Both pages initialize even when browser storage is blocked.
   const blocked=await win.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument',{source:"Storage.prototype.getItem=Storage.prototype.setItem=()=>{throw Error('blocked')};"});
   for(const page of ['index','getting-started']){
    await win.loadURL(base+page+'.html?lang=zh');await pause(80);
    assert.equal(await js('document.documentElement.lang'),'zh-CN');
    await js(`document.querySelector('[data-lang=ja]').click()`);
    assert.equal(await js('document.documentElement.lang'),'ja');
   }
   await win.webContents.debugger.sendCommand('Page.removeScriptToEvaluateOnNewDocument',{identifier:blocked.identifier});
  }
  win.setContentSize(390,844);await win.loadURL(base+'index.html?lang=zh');await pause(100);
  await js('document.documentElement.style.fontSize="200%"');await settle();
  await assertNoHorizontalOverflow(win.webContents,'Site 200% text');
  const demo=await startDemo();
  try {
   win.setContentSize(1440,1000);await win.loadURL(`http://127.0.0.1:${demo.address().port}`);await pause(80);
   await assertPalette(win.webContents);await assertNoHorizontalOverflow(win.webContents,'Demo');
   const click=id=>js(`document.getElementById('${id}').click()`);
   await click('begin');assert.equal(await js('document.querySelector("#annotation").classList.contains("show")'),true);
   await writeFile(join(after,'demo-desktop.png'),(await win.capturePage()).toPNG());
   await click('completed');await click('verify');assert.equal(await js('status'),'verification_failed');
   await click('begin');await click('allowActual');await click('completed');await click('verify');assert.equal(await js('status'),'verified');
   await click('begin');await click('declined');assert.equal(await js('status'),'declined');
   win.setContentSize(900,1000);await js('document.documentElement.style.fontSize="200%"');await pause(80);
   await assertNoHorizontalOverflow(win.webContents,'Demo 200% text');
  } finally {await new Promise(r=>demo.close(r));}
  win.webContents.debugger.detach();assert.deepEqual(errors,[]);
  await writeFile(join(baseline?before:after,'metrics.json'),JSON.stringify(metrics,null,2)+'\n');
  console.log(`PASS site ${baseline?'baseline':'regression'}: 18 locale/viewports, three scenes, both outcomes, reduced motion, clipboard fallback, saved language and demo verification branches. ${baseline?'Baseline saved.':compare?'Exact pixels/layout/motion match.':''}`);
 }finally{win?.destroy();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
}).then(()=>app.exit(0),error=>{console.error(error);app.exit(1);});
