/** Render and sample real CSS/SVG animations in an isolated Electron profile. */
import assert from 'node:assert/strict';
import {assertPalette,assertNoHorizontalOverflow} from './ui-design-assertions.mjs';
import {app,BrowserWindow} from 'electron';
import {mkdtempSync} from 'node:fs';
import {mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {startGallery} from './gallery.mjs';
import {SHAPES} from '../src/visual/scene.mjs';
const dir=mkdtempSync(join(tmpdir(),'hg-motion-'));app.setPath('userData',dir);
app.on('window-all-closed',()=>{});
const output=resolve(process.argv.find(a=>a.startsWith('--output='))?.slice(9)||'.tmp/overlay-motion');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
void app.whenReady().then(async()=>{
 const server=await startGallery();let win;const errors=[];const report={shapes:SHAPES.length,entrances:{},exits:{}};
 try{
  await mkdir(output,{recursive:true});
  win=new BrowserWindow({show:false,width:1400,height:1500,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  win.webContents.on('console-message',event=>{if(/Uncaught|Refused|Failed to load/i.test(event.message))errors.push(event.message);});
  console.log('Loading production gallery');
  await win.loadURL(`http://127.0.0.1:${server.address().port}/`);
  const js=source=>win.webContents.executeJavaScript(source);
  console.log('Sampling gallery');
  await assertPalette(win.webContents);await assertNoHorizontalOverflow(win.webContents,'Gallery');
  await pause(1200);
  await writeFile(join(output,'gallery.png'),(await win.webContents.capturePage()).toPNG());
  assert.equal(await js('document.querySelector("#canvas .hg-trace") && getComputedStyle(document.querySelector("#canvas .hg-trace")).animationName.includes("hg-handwrite")'),true,'Gallery failed to load production motion CSS');
  await js('document.querySelector("[data-view=collection]").click()');await pause(1400);
  assert.equal(await js('document.querySelectorAll(".specimen .hg-mark").length'),SHAPES.length);
  win.webContents.debugger.attach('1.3');
  const clip=await js('(()=>{const b=document.getElementById("mock").getBoundingClientRect();return {x:b.x+scrollX,y:b.y+scrollY,width:b.width,height:b.height,scale:1}})()');
  const shot=await win.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
  await writeFile(join(output,'mark-library.png'),Buffer.from(shot.data,'base64'));win.webContents.debugger.detach();
  await js(`(async()=>{window.render=(await import('/src/desktop/overlay-renderer.mjs')).renderOverlay;window.testSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');testSvg.setAttribute('style','position:fixed;inset:0;width:800px;height:500px;pointer-events:none');document.body.append(testSvg);})()`);
  const present=async(effect,exit='fade')=>js(`render(testSvg,{sessionId:${JSON.stringify(effect+exit+Math.random())},motion:'expressive',annotations:[{id:'target',shape:'ring',x:300,y:220,width:120,height:50,effect:${JSON.stringify(effect)},exit:${JSON.stringify(exit)},durationMs:500}]},{width:800,height:500})`);
  const opacity=()=>js('parseFloat(getComputedStyle(testSvg.querySelector(".hg-mark")).opacity)');
  for(const effect of ['fade','pop','draw']){
    await present(effect);await pause(60);const start=await opacity();await pause(180);const later=await opacity();
    if(effect!=='draw')assert.ok(start>0&&start<later&&later<1,`${effect} must progress: ${start} → ${later}`);
    if(effect==='pop')assert.notEqual(await js('getComputedStyle(testSvg.querySelector(".hg-mark")).transform'),'none');
    if(effect==='draw')assert.ok(parseFloat(await js('getComputedStyle(testSvg.querySelector(".hg-trace")).strokeDashoffset'))>0);
    report.entrances[effect]=[start,later];
  }
  for(const exit of ['fade','retract','shrink']){
    await present('draw',exit);await pause(650);
    await js('render(testSvg,{annotations:[],animateExit:true},{width:800,height:500})');await pause(55);
    const value=await opacity();assert.ok(value>0&&value<1,`${exit} must visibly retire`);
    if(exit==='retract')assert.ok(parseFloat(await js('getComputedStyle(testSvg.querySelector(".hg-trace")).strokeDashoffset'))>0);
    if(exit==='shrink')assert.notEqual(await js('getComputedStyle(testSvg.querySelector(".hg-mark")).transform'),'matrix(1, 0, 0, 1, 0, 0)');
    await pause(170);assert.equal(await js('testSvg.children.length'),0);report.exits[exit]=value;
  }
  // A safety invalidation interrupts an in-flight decorative exit in the same frame.
  await present('pop');await js('render(testSvg,{annotations:[],animateExit:true},{width:800,height:500});render(testSvg,{annotations:[]},{width:800,height:500})');
  assert.equal(await js('testSvg.children.length'),0);
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await present('pop');assert.equal(await js('getComputedStyle(testSvg.querySelector(".hg-mark")).animationName'),'none');
  await js('render(testSvg,{annotations:[],animateExit:true},{width:800,height:500})');assert.equal(await js('testSvg.children.length'),0);
  win.webContents.debugger.detach();report.reducedMotion=true;
  assert.deepEqual(errors,[]);await writeFile(join(output,'motion-result.json'),JSON.stringify(report,null,2)+'\n');
  console.log('PASS production gallery: 19 marks, fade/pop/draw progression, fade/retract/shrink teardown, safety clear and OS reduced motion');
 }finally{win?.destroy();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
}).then(()=>app.exit(0),error=>{console.error(error);app.exit(1);});
