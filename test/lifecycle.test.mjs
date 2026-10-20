import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,readdir,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {installCodex,uninstallCodex} from '../src/codex-install.mjs';
import {cleanupIntegration,appWorkbuddyDirectory} from '../src/integration-lifecycle.mjs';
import {parse} from 'smol-toml';
import {writeWorkbuddyBundle,prepareWorkbuddyBundle,WORKBUDDY_FILES} from '../src/workbuddy-bundle.mjs';
async function isolated(run){const home=await mkdtemp(join(tmpdir(),'hg-owned-'));try{await run({userHome:home,codexHome:join(home,'codex')},home);}finally{await rm(home,{recursive:true,force:true});}}

test('cleanup without a receipt preserves an identically named user MCP entry and skill',()=>isolated(async(options,home)=>{
 await mkdir(options.codexHome);const path=join(options.codexHome,'config.toml');
 const text='[mcp_servers.handoffglass]\ncommand="my-own-server"\n';await writeFile(path,text);
 const plan=await uninstallCodex({...options,apply:true});assert.equal(plan.state,'unmanaged');assert.equal(plan.applied,false);
 assert.equal(await readFile(path,'utf8'),text);
}));
test('receipt restores original replaced content and removes only its own backups and record',()=>isolated(async(options,home)=>{
 await mkdir(options.codexHome);const config=join(options.codexHome,'config.toml');
 const before='# keep exactly\nmodel="personal"\n\n[mcp_servers.handoffglass]\ncommand="old"\n';await writeFile(config,before);
 const installed=await installCodex({...options,replace:true,apply:true});
 await writeFile(join(options.codexHome,'unrelated-backup'),'keep');
 const result=await uninstallCodex({...options,apply:true});assert.equal(result.retained.length,0);
 assert.equal(await readFile(config,'utf8'),before);
 await assert.rejects(readFile(installed.skillPath),{code:'ENOENT'});
 assert.deepEqual((await readdir(options.codexHome)).sort(),['config.toml','unrelated-backup']);
}));
test('cleanup preserves later unrelated TOML values and edited skill; a second cleanup is idempotent',()=>isolated(async(options)=>{
 const installed=await installCodex({...options,apply:true});
 const source=await readFile(installed.configPath,'utf8');await writeFile(installed.configPath,source+'\n[mcp_servers.personal]\ncommand="keep"\n');
 await writeFile(installed.skillPath,'personal edits');
 const result=await uninstallCodex({...options,apply:true});assert.ok(result.retained.some(x=>x.kind==='skill'));
 const after=await readFile(installed.configPath,'utf8');assert.equal(parse(after).mcp_servers.personal.command,'keep');assert.equal(parse(after).mcp_servers.handoffglass,undefined);
 assert.equal(await readFile(installed.skillPath,'utf8'),'personal edits');
 const second=await uninstallCodex({...options,apply:true});assert.equal(second.applied,false);assert.equal(await readFile(installed.configPath,'utf8'),after);
}));
test('edited owned MCP entry is preserved while unchanged owned skill can be removed',()=>isolated(async(options)=>{
 const installed=await installCodex({...options,apply:true});await writeFile(installed.configPath,'[mcp_servers.handoffglass]\ncommand="edited"\n');
 const result=await uninstallCodex({...options,apply:true});assert.ok(result.retained.some(x=>x.kind==='mcp_entry'));
 assert.equal(parse(await readFile(installed.configPath,'utf8')).mcp_servers.handoffglass.command,'edited');
 await assert.rejects(readFile(installed.skillPath),{code:'ENOENT'});
}));
test('symbolic link parent cannot redirect skill installation',()=>isolated(async(options,home)=>{
 await mkdir(join(home,'elsewhere'));await symlink(join(home,'elsewhere'),join(home,'.agents'));
 await assert.rejects(installCodex({...options,apply:true}),/symlink/);assert.deepEqual(await readdir(join(home,'elsewhere')),[]);
}));
test('WorkBuddy removes recorded unchanged files and preserves additions and host-state uncertainty',()=>isolated(async(options,home)=>{
 const root=join(home,'project'),destination=join(root,'dist','workbuddy-local');
 execFileSync(process.execPath,['scripts/build-workbuddy.mjs',destination]);
 await writeFile(join(destination,'notes.txt'),'user addition');await writeFile(join(destination,'icon.svg'),'edited');
 const preview=await cleanupIntegration('workbuddy',{root,dir:join(home,'runtime')});assert.equal(preview.applied,false);assert.equal(preview.hostState,'not_observed');
 const result=await cleanupIntegration('workbuddy',{root,dir:join(home,'runtime'),confirm:true});assert.equal(result.complete,false);
 assert.equal(await readFile(join(destination,'notes.txt'),'utf8'),'user addition');assert.equal(await readFile(join(destination,'icon.svg'),'utf8'),'edited');
 await assert.rejects(readFile(join(destination,'mcp.json')),{code:'ENOENT'});
}));

test('updating a bundled Skill retains original recovery data and cleans supporting resources',()=>isolated(async(options)=>{
 const installed=await installCodex({...options,apply:true});
 const recordPath=join(options.codexHome,'handoffglass-install.json'),record=JSON.parse(await readFile(recordPath,'utf8'));
 record.skill.installed='previous HandoffGlass version';await writeFile(installed.skillPath,record.skill.installed);await writeFile(recordPath,JSON.stringify(record));
 await installCodex({...options,apply:true,replace:true});
 const updated=JSON.parse(await readFile(recordPath,'utf8'));assert.equal(updated.skill.before,null);
 const reference=join(options.userHome,'.agents','skills','visual-handoff','references','tool-contracts.md');assert.match(await readFile(reference,'utf8'),/session_wait/);
 await uninstallCodex({...options,apply:true});await assert.rejects(readFile(reference),{code:'ENOENT'});
 assert.deepEqual(await readdir(join(options.userHome,'.agents','skills')),[]);
}));
test('comments added to an installed table are preserved as user edits',()=>isolated(async(options)=>{
 const installed=await installCodex({...options,apply:true});const current=await readFile(installed.configPath,'utf8');
 await writeFile(installed.configPath,current+'# my note\n');const result=await uninstallCodex({...options,apply:true});
 assert.ok(result.retained.some(x=>x.kind==='mcp_entry'));assert.match(await readFile(installed.configPath,'utf8'),/# my note/);
}));

test('rebuilding a WorkBuddy bundle refuses edits before writing any other file',()=>isolated(async(options,home)=>{
 const destination=join(home,'bundle'),first=Object.fromEntries(WORKBUDDY_FILES.map(file=>[file,'old '+file]));
 assert.equal((await writeWorkbuddyBundle(destination,first)).changed,true);
 assert.equal((await writeWorkbuddyBundle(destination,first)).changed,false);
 const record=await readFile(join(destination,'handoffglass-files.json'),'utf8');
 await writeFile(join(destination,'icon.svg'),'personal icon');
 const next=Object.fromEntries(WORKBUDDY_FILES.map(file=>[file,'new '+file]));
 await assert.rejects(writeWorkbuddyBundle(destination,next),/preserving it: icon.svg/);
 assert.equal(await readFile(join(destination,'connector-meta.json'),'utf8'),first['connector-meta.json']);
 assert.equal(await readFile(join(destination,'icon.svg'),'utf8'),'personal icon');
 assert.equal(await readFile(join(destination,'handoffglass-files.json'),'utf8'),record);
}));
test('WorkBuddy rebuild updates recorded files while preserving unrelated additions',()=>isolated(async(options,home)=>{
 const destination=join(home,'bundle'),contents=Object.fromEntries(WORKBUDDY_FILES.map(file=>[file,'first '+file]));
 await writeWorkbuddyBundle(destination,contents);await writeFile(join(destination,'notes.txt'),'keep');
 contents['skills/visual-handoff/SKILL.md']='updated skill';
 assert.equal((await writeWorkbuddyBundle(destination,contents)).changed,true);
 assert.equal(await readFile(join(destination,'skills/visual-handoff/SKILL.md'),'utf8'),'updated skill');
 assert.equal(await readFile(join(destination,'notes.txt'),'utf8'),'keep');
}));
test('WorkBuddy builder preserves unrecorded files and refuses symlink redirects',()=>isolated(async(options,home)=>{
 const destination=join(home,'bundle'),contents=Object.fromEntries(WORKBUDDY_FILES.map(file=>[file,'new '+file]));
 await mkdir(destination);await writeFile(join(destination,'mcp.json'),'personal server');
 await assert.rejects(writeWorkbuddyBundle(destination,contents),/unrecorded or changed/);
 assert.deepEqual(await readdir(destination),['mcp.json']);
 const linked=join(home,'linked');await symlink(destination,linked);
 await assert.rejects(writeWorkbuddyBundle(linked,contents),/symlink/);
}));
test('the app connector and CLI bundle share safe cleanup and preserve host uncertainty',()=>isolated(async(options,home)=>{
 const root=join(home,'project'),dir=join(home,'runtime'),appBundle=appWorkbuddyDirectory(dir),cliBundle=join(root,'dist','workbuddy-local');
 await prepareWorkbuddyBundle(appBundle,{command:'/Applications/HandoffGlass',entry:'/app.asar/src/mcp.mjs',envOverrides:{ELECTRON_RUN_AS_NODE:'1'}});
 await prepareWorkbuddyBundle(cliBundle);
 const payload=JSON.parse(await readFile(join(appBundle,'mcp.json'),'utf8'));
 assert.deepEqual(Object.keys(payload.mcpServers),['handoffglass']);
 assert.equal(payload.mcpServers.handoffglass.env.ELECTRON_RUN_AS_NODE,'1');
 assert.equal(payload.mcpServers.handoffglass.env.HANDOFFGLASS_HOST_ID,'workbuddy');
 assert.equal(payload.mcpServers.handoffglass.runtime.version,'22');
 const metadata=JSON.parse(await readFile(join(appBundle,'connector-meta.json'),'utf8'));assert.ok(metadata.minWorkbuddyVersion);
 const preview=await cleanupIntegration('workbuddy',{root,dir});
 assert.ok(preview.items.some(i=>i.path.startsWith(appBundle)));assert.ok(preview.items.some(i=>i.path.startsWith(cliBundle)));
 const result=await cleanupIntegration('workbuddy',{root,dir,confirm:true});assert.equal(result.complete,false);assert.equal(result.hostState,'not_observed');
 await assert.rejects(readFile(join(appBundle,'mcp.json')),{code:'ENOENT'});
 await assert.rejects(readFile(join(cliBundle,'mcp.json')),{code:'ENOENT'});
}));
