import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,symlink,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {pluginSnapshot} from '../src/plugin-snapshot.mjs';
import {applyFileTransaction,readManagedBytes,readManagedLink} from '../src/managed-files.mjs';
import {buildHarnessPlugin,removeHarnessPlugin} from '../src/harness-plugin.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const runCli=promisify(execFile);
async function temp(run){const dir=await mkdtemp(join(tmpdir(),'hg-snapshot-test-'));try{await run(dir);}finally{await rm(dir,{recursive:true,force:true});}}
test('plugin refuses incomplete Electron before attempting any runtime startup',()=>temp(async dir=>{
 await assert.rejects(pluginSnapshot(dir,{desktop:true}),e=>e.code==='desktop_runtime_missing');
}));
test('managed writes retain binary bytes, executable mode and recorded relative links',()=>temp(async dir=>{
 const path=join(dir,'binary'),link=join(dir,'current'),bytes=Buffer.from([0,255,128,10]);
 await applyFileTransaction([{path,prior:null,next:bytes,mode:0o755},{path:link,prior:null,next:'binary',kind:'symlink'}]);
 assert.deepEqual(await readManagedBytes(path),bytes);assert.equal(await readManagedLink(link),'binary');
 if(process.platform!=='win32')assert.equal((await lstat(path)).mode&0o777,0o755);
 await writeFile(path,'user edit');await assert.rejects(applyFileTransaction([{path,prior:bytes,next:null}]),/changed/);assert.equal(await readFile(path,'utf8'),'user edit');
}));
test('three native bundles carry runtime snapshots, expose current tools and remove only owned files',()=>temp(async dir=>{
 for(const host of ['claude-code','deepseek','opencode']){
  const output=join(dir,host);await buildHarnessPlugin({host,output,desktopRuntime:false});
  assert.equal(JSON.parse(await readFile(join(output,'runtime-evidence.json'))).endToEnd,'unverified');
  assert.ok(await readFile(join(output,'runtime/src/hosts/native-tools.mjs')));
  const entry=host==='claude-code'?'.mcp.json':host==='deepseek'?'src/plugin.ts':'index.ts';
  assert.ok(!(await readFile(join(output,entry),'utf8')).includes(root));
  if(host==='claude-code')assert.match(await readFile(join(output,'.mcp.json'),'utf8'),/CLAUDE_PLUGIN_ROOT/);
  else assert.match(await readFile(join(output,entry),'utf8'),/nativeTools/);
  if(host==='deepseek'){
   const peers=JSON.parse(await readFile(join(output,'package.json'),'utf8')).peerDependencies;
   assert.equal(peers['@deepseek-ai/cordis'],'4.1.0');
   for(const name of ['dsh-agent','dsh-tools','dsh-llm'])assert.equal(peers['@deepseek-ai/'+name],'0.2.2-rc.2');
  }
  await writeFile(join(output,'NOTICE'),'user notice');await writeFile(join(output,'my-note.txt'),'keep');
  const plan=await removeHarnessPlugin({host,output});assert.equal(plan.applied,false);assert.equal(plan.retained.length,2);
  await removeHarnessPlugin({host,output,confirm:true});assert.equal(await readFile(join(output,'my-note.txt'),'utf8'),'keep');assert.equal(await readFile(join(output,'NOTICE'),'utf8'),'user notice');
  await assert.rejects(readFile(join(output,'runtime-evidence.json')),{code:'ENOENT'});
 }
}));
test('documented harness CLI builds, previews and removes the named bundle',()=>temp(async dir=>{
 const output=join(dir,'claude-preview');
 const run=async action=>JSON.parse((await runCli(process.execPath,[join(root,'scripts/harness-plugin.mjs'),...action,'claude-code','--output='+output,'--no-desktop'],{cwd:root})).stdout);
 await run(['build']);
 assert.equal(JSON.parse(await readFile(join(output,'.claude-plugin/plugin.json'))).name,'handoffglass');
 assert.equal((await run(['remove'])).applied,false);
 await readFile(join(output,'.mcp.json'));
 const applied=JSON.parse((await runCli(process.execPath,[join(root,'scripts/harness-plugin.mjs'),'remove','claude-code','--output='+output,'--apply'],{cwd:root})).stdout);
 assert.equal(applied.applied,true);
 await assert.rejects(readFile(join(output,'.mcp.json')),{code:'ENOENT'});
}));
