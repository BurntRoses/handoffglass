import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
test('deterministic brand icons are generated without external raster dependencies',async()=>{
  execFileSync(process.execPath,[join(root,'scripts/build-icons.mjs')],{cwd:root,stdio:'pipe'});
  const base=join(root,'build/icons');
  for(const size of [32,256,512,1024]){
    const data=await readFile(join(base,`icon-${size}.png`));
    assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(data.readUInt32BE(16),size);
    assert.equal(data.readUInt32BE(20),size);
  }
  const ico=await readFile(join(base,'icon.ico'));
  assert.equal(ico.readUInt16LE(2),1);
  assert.equal(ico.readUInt16LE(4),6);
  const icns=await readFile(join(base,'icon.icns'));
  assert.equal(icns.toString('ascii',0,4),'icns');
  assert.equal(icns.readUInt32BE(4),icns.length);
});
test('first-run desktop setup is IPC-scoped and preserves explicit opt-in',async()=>{
 const setup=await readFile(join(root,'src/desktop/setup.mjs'),'utf8');
 const app=await readFile(join(root,'src/desktop/main.mjs'),'utf8');
 const preload=await readFile(join(root,'src/desktop/setup-preload.cjs'),'utf8');
 const html=await readFile(join(root,'src/desktop/setup.html'),'utf8');
 const setupJs=await readFile(join(root,'src/desktop/setup.js'),'utf8');
 assert.match(setup,/event\.sender===window\.webContents/);
 assert.match(setup,/setAccessibilityConsent\(accessibility\)/);
 assert.match(app,/registerSetupIPC\(\)/);
 assert.match(app,/maybeShowFirstRun\(\)/);
 assert.match(preload,/contextBridge\.exposeInMainWorld/);
 assert.match(html,/id="accessibility"/);
 assert.doesNotMatch(html,/accessibility"[^>]*checked/i);
 assert.match(html,/Content-Security-Policy/);
 assert.match(setupJs,/replaceChildren\(document\.createTextNode/,'locale changes must replace the heading');
});
test('cross-platform branded icon paths and build task are configured',async()=>{
 const config=await readFile(join(root,'electron-builder.config.cjs'),'utf8');
 const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
 assert.match(config,/build\/icons\/icon\.icns/);
 assert.match(config,/build\/icons\/icon\.ico/);
 assert.match(pkg.scripts['build:icons'],/build-icons/);
 assert.match(pkg.scripts['dist:desktop'],/build:icons/);
});
test('multilingual onboarding guide has scoped local setup and no hidden network requests',async()=>{
 const guide=await readFile(join(root,'site/getting-started.html'),'utf8');
 const js=await readFile(join(root,'site/guide.mjs'),'utf8');
 const home=await readFile(join(root,'site/index.html'),'utf8');
 assert.match(guide,/guide\.mjs/);
 assert.match(home,/getting-started\.html/);
 for(const key of ['en','zh','ja'])assert.match(js,new RegExp(`\\b${key}:\\{`));
 assert.doesNotMatch(js, /\beval\s*\(|\binnerHTML\s*=/);
 for(const path of ['site/guide.css','site/guide.mjs','src/desktop/setup.css','src/desktop/setup.js'])assert.ok((await stat(join(root,path))).size>200);
});
