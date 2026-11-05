import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {registerApplicationInstallation,planApplicationFiles,readApplicationInstallation,snapshotTree} from '../src/application-installation.mjs';
import {uninstallApplication} from '../src/integration-lifecycle.mjs';
import {installCodex} from '../src/codex-install.mjs';
import {removeOwnedFiles} from '../scripts/remove-owned-files.mjs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readManifest,probe} from '../src/runtime.mjs';
const isolated=async run=>{const userHome=await mkdtemp(join(tmpdir(),'hg-uninstall-'));try{await run({userHome,dir:join(userHome,'.handoffglass'),codexHome:join(userHome,'.codex'),root:join(userHome,'source'),platform:'darwin'});}finally{await rm(userHome,{recursive:true,force:true});}};
async function workerResult(applied){
 let raw='',error='';
 for(let i=0;i<800;i++){try{raw=await readFile(applied.resultPath,'utf8');return JSON.parse(raw.replace(/^\uFEFF/,''));}catch(e){error=e.message;}await new Promise(r=>setTimeout(r,50));}
 assert.fail('External worker did not produce valid JSON: '+error+'; log='+await readFile(applied.workerLogPath,'utf8')+'; result='+raw);
}
async function fakeApp(home){const path=join(home,'Applications','HandoffGlass.app');await mkdir(join(path,'Contents'),{recursive:true});await writeFile(join(path,'Contents','Info.plist'),'<plist><dict><key>CFBundleIdentifier</key><string>dev.handoffglass.desktop</string></dict></plist>');await writeFile(join(path,'Contents','application'),'installed package');return path;}

test('registered package removal preserves edits and additions and does not follow links',()=>isolated(async options=>{
 const appPath=await fakeApp(options.userHome);await registerApplicationInstallation({...options,appPath,appVersion:'test'});
 await writeFile(join(appPath,'Contents','application'),'user edit');await writeFile(join(appPath,'notes.txt'),'keep');
 const plan=await planApplicationFiles(options),result=await removeOwnedFiles(plan);
 assert.equal(await readFile(join(appPath,'Contents','application'),'utf8'),'user edit');assert.equal(await readFile(join(appPath,'notes.txt'),'utf8'),'keep');
 assert.ok(result.retained.some(e=>e.reason==='changed_by_user'));assert.ok(result.retained.some(e=>e.reason==='contains_unrecorded_files'));
}));
test('uninstallation refuses traversal in a forged package record and unrelated data paths',()=>isolated(async options=>{
 const appPath=await fakeApp(options.userHome);await registerApplicationInstallation({...options,appPath});
 await assert.rejects(registerApplicationInstallation({...options,appPath,dataPaths:[options.userHome]}),/Unrecognized/);
 const file=join(options.dir,'application-installation.json'),record=JSON.parse(await readFile(file,'utf8'));
 record.entries.push({path:appPath+'/../private',kind:'file',digest:'a'.repeat(64)});await writeFile(file,JSON.stringify(record));
 await assert.rejects(readApplicationInstallation(options),/Invalid application ownership/);
}));
test('standalone remover preserves a symlink that redirects a previously recorded file',()=>isolated(async options=>{
 const folder=join(options.userHome,'owned');await mkdir(folder);await writeFile(join(folder,'data'),'owned');
 const entries=await snapshotTree(folder),other=join(options.userHome,'private');await writeFile(other,'keep');await rm(join(folder,'data'));await symlink(other,join(folder,'data'));
 const result=await removeOwnedFiles({entries});assert.equal(await readFile(other,'utf8'),'keep');assert.equal(result.complete,false);
}));
test('full uninstall previews without writing and executes through a real external worker',()=>isolated(async options=>{
 await registerApplicationInstallation(options);await installCodex({...options,apply:true});
 await writeFile(join(options.dir,'preferences.json'),JSON.stringify({version:1,enabled:false}),{mode:0o600});
 await writeFile(join(options.dir,'desktop.json'),JSON.stringify({pid:2147483647,port:12345,desktopToken:'b'.repeat(64)}),{mode:0o600});
 await mkdir(options.root,{recursive:true});await writeFile(join(options.root,'development.txt'),'keep source');
 const before=await readdir(options.dir),preview=await uninstallApplication(options);
 assert.equal(preview.scheduled,false);assert.deepEqual(await readdir(options.dir),before);
 const applied=await uninstallApplication({...options,confirm:true,waitPids:[]});assert.equal(applied.scheduled,true);
 const result=await workerResult(applied);assert.equal(result.complete,true,JSON.stringify(result));
 await assert.rejects(readFile(join(options.codexHome,'config.toml')),{code:'ENOENT'});await assert.rejects(readdir(options.dir),{code:'ENOENT'});
 assert.equal(await readFile(join(options.root,'development.txt'),'utf8'),'keep source');await rm(dirname(applied.resultPath),{recursive:true,force:true});
}));

test('standalone uninstall shuts down its authenticated Broker before deleting runtime data',()=>isolated(async options=>{
 const child=spawn(process.execPath,[fileURLToPath(new URL('../src/broker.mjs',import.meta.url))],{
   env:{...process.env,HANDOFFGLASS_RUNTIME_DIR:options.dir,HANDOFFGLASS_HEADLESS:'1',CODEX_HOME:options.codexHome},stdio:'ignore'});
 try {
  let broker;for(let i=0;i<150;i++){broker=await readManifest(options.dir);if(broker&&await probe(broker))break;await new Promise(r=>setTimeout(r,20));}
  assert.ok(broker&&await probe(broker),'isolated Broker must be running');
  const applied=await uninstallApplication({...options,confirm:true,waitPids:[]});
  const result=await workerResult(applied);assert.equal(result.complete,true,JSON.stringify(result));
  assert.ok(child.exitCode!==null||child.signalCode!==null,'Broker must exit');
  await assert.rejects(readdir(options.dir),{code:'ENOENT'});await rm(dirname(applied.resultPath),{recursive:true,force:true});
 }finally{if(child.exitCode===null&&child.signalCode===null)child.kill();}
}));
