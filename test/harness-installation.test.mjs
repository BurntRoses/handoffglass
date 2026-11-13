import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,access} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {harnessStatus,installHarness,setHarnessEnabled,cleanupHarness} from '../src/harness-installation.mjs';
import {parseJsonc,editJsoncMember,editJsoncArrayReference,jsoncValue} from '../src/local/jsonc-edit.mjs';
async function write(path,text){await mkdir(dirname(path),{recursive:true});await writeFile(path,text);}
async function fixture(run){
 const base=await mkdtemp(join(tmpdir(),'hg-harness-owned-')),root=join(base,'source'),home=join(base,'home'),dir=join(base,'runtime');
 try{
  const files={'package.json':JSON.stringify({name:'handoffglass',version:'0.22.1'}),'package-lock.json':'{"packages":{}}','src/mcp.mjs':'// test runtime','assets/icon.svg':'<svg/>','skills/visual-handoff/SKILL.md':'# HandoffGlass','skills/visual-handoff/references/tool-contracts.md':'# Contracts','LICENSE':'license','NOTICE':'notice','integrations/claude-code/plugin.json':'{"name":"handoffglass"}','integrations/deepseek-harness/src/plugin.ts':'// nativeTools','integrations/opencode/index.ts':'// nativeTools','scripts/claude-hook.mjs':'// hook','scripts/remove-owned-files.mjs':'// remover','scripts/remove-owned-files.ps1':'# remover'};
  for(const [name,text]of Object.entries(files))await write(join(root,name),text);
  await mkdir(home);await run({base,root,home,dir,desktopRuntime:false});
 }finally{await rm(base,{recursive:true,force:true});}
}
test('JSONC edits preserve comments and other properties, including strings containing comment markers',()=>{
 const source='{\n // keep heading\n "mcpServers": {"other": {"url":"https://x/*s*/"}, /* peer */},\n "theme": "dark",\n}\n';
 const inserted=editJsoncMember(source,['mcpServers','handoffglass'],{command:'node'});
 assert.equal(jsoncValue(inserted,['mcpServers','handoffglass','command']),'node');assert.ok(inserted.includes('/* peer */'));assert.ok(inserted.includes('"theme": "dark"'));
 const removed=editJsoncMember(inserted,['mcpServers','handoffglass'],null,{remove:true});
 assert.equal(jsoncValue(removed,['mcpServers','other','url']),'https://x/*s*/');assert.ok(removed.includes('// keep heading'));
 assert.throws(()=>parseJsonc('{"x":1,"x":2}'),/malformed/);assert.throws(()=>parseJsonc('{"x":1 /*'),/malformed/);
});
test('plugin array edits retain peer entries, object options and inline comments',()=>{
 const source='{ "plugins": ["one", /* keep */ {"package":"two", "options":{"x":1}},], "other":true }';
 const added=editJsoncArrayReference(source,'plugins','/owned/plugin',true);assert.equal(jsoncValue(added,['plugins']).length,3);
 const removed=editJsoncArrayReference(added,'plugins','/owned/plugin',false);assert.equal(jsoncValue(removed,['plugins']).length,2);assert.ok(removed.includes('/* keep */'));assert.ok(removed.includes('"options":{"x":1}'));
});
test('preview is read-only and does not invoke host commands or construct a runtime',()=>fixture(async options=>{
 const preview=await installHarness('claude-code',{...options,runCommand(){throw Error('must not run');}});
 assert.equal(preview.applied,false);assert.equal(preview.confirmationRequired,true);await assert.rejects(access(options.dir),{code:'ENOENT'});
 assert.equal((await harnessStatus('cursor',options)).installed,false);
}));
test('Cursor install/update/disable/enable/remove preserve user fields and use a self-contained stable identity',()=>fixture(async options=>{
 const config=join(options.home,'.cursor','mcp.json'),prior='{\n// personal\n"mcpServers":{"other":{"command":"other"}},"theme":"dark"\n}\n';await write(config,prior);
 const installed=await installHarness('cursor',{...options,confirm:true,command:'/Applications/Test Electron',envOverrides:{ELECTRON_RUN_AS_NODE:'1'}});
 assert.equal(installed.installed,true);assert.equal(installed.hostState,'not_observed');assert.equal((await harnessStatus('cursor',options)).configurationMatches,true);
 let raw=await readFile(config,'utf8');assert.ok(raw.includes('// personal'));assert.equal(jsoncValue(raw,['mcpServers','handoffglass','env','HANDOFFGLASS_CONNECTION_ID']),installed.installationId);assert.equal(jsoncValue(raw,['mcpServers','handoffglass','env','ELECTRON_RUN_AS_NODE']),'1');
 const updated=await installHarness('cursor',{...options,confirm:true,command:'/Applications/Test Electron',envOverrides:{ELECTRON_RUN_AS_NODE:'1'}});assert.equal(updated.installationId,installed.installationId);
 await setHarnessEnabled('cursor',false,options);raw=await readFile(config,'utf8');assert.equal(jsoncValue(raw,['mcpServers','handoffglass']),undefined);assert.equal(jsoncValue(raw,['mcpServers','other','command']),'other');assert.equal((await harnessStatus('cursor',options)).enabled,false);
 await setHarnessEnabled('cursor',true,options);raw=await readFile(config,'utf8');assert.equal(jsoncValue(raw,['mcpServers','handoffglass','env','HANDOFFGLASS_CONNECTION_ID']),installed.installationId);
 const plan=await cleanupHarness('cursor',options);assert.equal(plan.applied,false);assert.equal((await harnessStatus('cursor',options)).installed,true);
 const removed=await cleanupHarness('cursor',{...options,confirm:true});assert.equal(removed.complete,true);assert.equal(await readFile(config,'utf8'),prior);assert.equal((await harnessStatus('cursor',options)).installed,false);
}));
test('cleanup preserves unrelated edits made after install instead of restoring an old whole-file backup',()=>fixture(async options=>{
 const config=join(options.home,'.cursor','mcp.json');await write(config,'{"mcpServers":{},"theme":"dark"}\n');
 await installHarness('cursor',{...options,confirm:true});
 const raw=await readFile(config,'utf8');await writeFile(config,editJsoncMember(raw,['theme'],'light'));
 const removed=await cleanupHarness('cursor',{...options,confirm:true});assert.equal(removed.complete,true);
 const remaining=await readFile(config,'utf8');assert.equal(jsoncValue(remaining,['theme']),'light');assert.deepEqual(Object.keys(jsoncValue(remaining,['mcpServers'])),[]);
}));
test('edited owned MCP entries are retained with their runtime and never overwritten or silently disabled',()=>fixture(async options=>{
 const config=join(options.home,'.cursor','mcp.json'),installed=await installHarness('cursor',{...options,confirm:true});
 const raw=await readFile(config,'utf8');await writeFile(config,editJsoncMember(raw,['mcpServers','handoffglass','args'],['my-edited-entry']));
 assert.equal((await harnessStatus('cursor',options)).configurationMatches,false);
 await assert.rejects(setHarnessEnabled('cursor',false,options),/changed/);await assert.rejects(installHarness('cursor',{...options,confirm:true}),/changed/);
 const removed=await cleanupHarness('cursor',{...options,confirm:true});assert.equal(removed.complete,false);assert.ok(removed.retained.some(f=>f.path===config));await access(join(installed.output,'runtime/src/mcp.mjs'));
}));
test('unmanaged MCP entries are never adopted by install',()=>fixture(async options=>{
 const config=join(options.home,'.cursor','mcp.json');await write(config,'{"mcpServers":{"handoffglass":{"command":"mine"}}}');
 await assert.rejects(installHarness('cursor',{...options,confirm:true}),/unmanaged/);assert.equal(jsoncValue(await readFile(config,'utf8'),['mcpServers','handoffglass','command']),'mine');await assert.rejects(access(options.dir),{code:'ENOENT'});
}));
test('OpenCode v2 installation edits only its own plural plugins reference in JSONC',()=>fixture(async options=>{
 const config=join(options.home,'.config','opencode','opencode.jsonc'),prior='{\n// saved\n"plugins":["existing", /* keep */ {"package":"p","options":{"x":1}}],"provider":{"test":{}}\n}';await write(config,prior);
 const installed=await installHarness('opencode',{...options,confirm:true});
 assert.equal(jsoncValue(await readFile(config,'utf8'),['plugins']).at(-1),installed.output);await setHarnessEnabled('opencode',false,options);assert.equal(jsoncValue(await readFile(config,'utf8'),['plugins']).length,2);
 await setHarnessEnabled('opencode',true,options);const removed=await cleanupHarness('opencode',{...options,confirm:true});assert.equal(removed.complete,true);assert.equal(await readFile(config,'utf8'),prior);
}));
test('TRAE requires an explicit supported config location and preserves the project MCP opt-in boundary',()=>fixture(async options=>{
 await assert.rejects(installHarness('trae',options),error=>error.code==='configuration_path_required');
 const workspace=join(options.base,'project');await mkdir(workspace);
 const installed=await installHarness('trae',{...options,workspace,confirm:true});assert.equal(installed.nextAction,'enable_project_mcp_and_reload');
 const config=join(workspace,'.trae','mcp.json');await access(config);assert.equal((await cleanupHarness('trae',{...options,confirm:true})).complete,true);await assert.rejects(access(config),{code:'ENOENT'});
}));
test('DeepSeek uses an absolute official patch and owned launcher; disabling is represented in its patch',()=>fixture(async options=>{
 const installed=await installHarness('deepseek',{...options,confirm:true,harnessCommand:'pnpm',harnessArgs:['dsh','web'],workspace:options.base});
 assert.ok((await readFile(join(installed.output,'cordis.yml'),'utf8')).includes(JSON.stringify(join(installed.output,'src/plugin.ts'))));assert.ok(Array.isArray(installed.launchCommand));
 assert.ok((await readFile(installed.launchCommand[1],'utf8')).includes('"--patch"'));assert.equal((await harnessStatus('deepseek',options)).configurationMatches,true);
 await setHarnessEnabled('deepseek',false,options);assert.match(await readFile(join(installed.output,'cordis.yml'),'utf8'),/disabled: true/);
 await installHarness('deepseek',{...options,confirm:true});assert.match(await readFile(join(installed.output,'cordis.yml'),'utf8'),/disabled: true/);
 await setHarnessEnabled('deepseek',true,options);assert.equal((await cleanupHarness('deepseek',{...options,confirm:true})).complete,true);
}));
test('DeepSeek Electron launch metadata is explicit and Electron-only environment is removed before the actual harness',()=>fixture(async options=>{
 const child=join(options.base,'fixture-harness.mjs'),resultPath=join(options.base,'child-env.json');
 await write(child,`import {writeFile} from 'node:fs/promises';\nawait writeFile(${JSON.stringify(resultPath)},JSON.stringify({electron:process.env.ELECTRON_RUN_AS_NODE??null,marker:process.env.HG_LAUNCH_TEST,args:process.argv.slice(2)}));\n`);
 const installed=await installHarness('deepseek',{...options,confirm:true,command:'/Applications/HandoffGlass.app/Contents/MacOS/HandoffGlass',envOverrides:{ELECTRON_RUN_AS_NODE:'1',NOT_A_LAUNCH_ENV:'private'},harnessCommand:process.execPath,harnessArgs:[child]});
 assert.deepEqual(installed.launchEnv,{ELECTRON_RUN_AS_NODE:'1'});
 const status=await harnessStatus('deepseek',options);assert.deepEqual(status.launchEnv,installed.launchEnv);
 const record=JSON.parse(await readFile(join(options.dir,'harnesses','deepseek','installation.json')));assert.deepEqual(record.launchEnv,installed.launchEnv);
 await promisify(execFile)(process.execPath,[installed.launchCommand[1]],{env:{...process.env,...installed.launchEnv,HG_LAUNCH_TEST:'keep'}});
 const result=JSON.parse(await readFile(resultPath));assert.equal(result.electron,null);assert.equal(result.marker,'keep');assert.deepEqual(result.args,['--patch',join(installed.output,'cordis.yml')]);
}));
function claudeRunner(options,{failInstall=false}={}){
 const calls=[],state={installed:false,enabled:true,marketplace:null};
 const runCommand=async(command,args,{env})=>{
  calls.push(args);assert.equal(command,'claude');assert.equal(env.CLAUDE_CONFIG_DIR,join(options.home,'.claude'));
  const action=args[1];if(action==='list')return {stdout:JSON.stringify(state.installed?[{id:'handoffglass@handoffglass-local',scope:'user',enabled:state.enabled}]:[])};
  if(action==='marketplace'&&args[2]==='list')return {stdout:JSON.stringify(state.marketplace?[{name:'handoffglass-local',path:state.marketplace}]:[])};
  if(action==='marketplace'&&args[2]==='add')state.marketplace=args[3];
  if(action==='marketplace'&&args[2]==='remove'){state.marketplace=null;state.installed=false;}
  if(action==='install'){if(failInstall)throw Error('fixture install failed');state.installed=true;state.enabled=true;}
  if(action==='uninstall')state.installed=false;
  if(action==='disable')state.enabled=false;if(action==='enable')state.enabled=true;
  const settings=join(options.home,'.claude','settings.json');await write(settings,JSON.stringify({theme:'dark',enabledPlugins:state.installed?{'handoffglass@handoffglass-local':state.enabled}: {}}));
  return {stdout:JSON.stringify({outcome:'ok'})};
 };
 return {calls,state,runCommand};
}
test('Claude install/update/enable/disable/uninstall use scoped host commands and never trust hooks',()=>fixture(async options=>{
 const fake=claudeRunner(options),o={...options,runCommand:fake.runCommand};
 const installed=await installHarness('claude-code',{...o,confirm:true});assert.equal(fake.state.installed,true);assert.equal((await harnessStatus('claude-code',o)).configurationMatches,true);
 const market=JSON.parse(await readFile(join(fake.state.marketplace,'.claude-plugin','marketplace.json')));assert.equal(market.plugins[0].source,'./plugins/handoffglass');
 await installHarness('claude-code',{...o,confirm:true});assert.ok(fake.calls.some(args=>args[1]==='update'));
 await setHarnessEnabled('claude-code',false,o);assert.equal(fake.state.enabled,false);await setHarnessEnabled('claude-code',true,o);assert.equal(fake.state.enabled,true);
 assert.ok(fake.calls.every(args=>!args.includes('--yes')&&!args.includes('--prune')));
 const removed=await cleanupHarness('claude-code',{...o,confirm:true});assert.equal(removed.complete,true);assert.equal(fake.state.installed,false);assert.equal(fake.state.marketplace,null);assert.equal(JSON.parse(await readFile(join(options.home,'.claude','settings.json'))).theme,'dark');
 await assert.rejects(access(join(installed.output,'runtime/src/mcp.mjs')),{code:'ENOENT'});
}));
test('failed first Claude install rolls back owned runtime files and the registered marketplace',()=>fixture(async options=>{
 const fake=claudeRunner(options,{failInstall:true});
 await assert.rejects(installHarness('claude-code',{...options,confirm:true,runCommand:fake.runCommand}),error=>error.code==='host_install_failed'&&error.rollbackComplete===true);
 assert.equal(fake.state.marketplace,null);assert.equal((await harnessStatus('claude-code',options)).installed,false);
}));
test('same-host overlapping mutations return already_running instead of registering a second native plugin',()=>fixture(async options=>{
 const fake=claudeRunner(options);let release,entered;
 const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
 const runCommand=async(...args)=>{entered();await gate;return fake.runCommand(...args);};
 const first=installHarness('claude-code',{...options,confirm:true,runCommand});await started;
 const second=await installHarness('claude-code',{...options,confirm:true,runCommand});assert.equal(second.code,'already_running');assert.equal(second.applied,false);
 release();await first;assert.equal(fake.calls.filter(args=>args[1]==='install').length,1);
}));
test('connection evidence requires the installed connection id and exact owned connection manifest',()=>fixture(async options=>{
 const installed=await installHarness('opencode',{...options,confirm:true});assert.equal((await harnessStatus('opencode',options)).configurationMatches,true);
 const path=join(installed.output,'connection.json'),raw=JSON.parse(await readFile(path));raw.env.HANDOFFGLASS_CONNECTION_ID='different';await writeFile(path,JSON.stringify(raw));
 assert.equal((await harnessStatus('opencode',options)).configurationMatches,false);
}));
