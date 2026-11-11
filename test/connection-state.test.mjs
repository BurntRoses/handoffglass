import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {installCodex,uninstallCodex} from '../src/codex-install.mjs';
import {connectionState} from '../src/connection-state.mjs';
import {prepareWorkbuddyBundle} from '../src/workbuddy-bundle.mjs';
import {buildCodexPlugin,CODEX_PLUGIN} from '../src/codex-plugin.mjs';
const isolated=async run=>{const userHome=await mkdtemp(join(tmpdir(),'hg-connection-'));try{await run({userHome,dir:join(userHome,'runtime'),codexHome:join(userHome,'codex')});}finally{await rm(userHome,{recursive:true,force:true});}};
test('only successful calls matching the installed connection id satisfy verification',()=>isolated(async options=>{
 const installed=await installCodex({...options,apply:true}),now=100000;
 assert.equal((await connectionState('codex',{...options,now})).hostVerified,false);
 const hostActivity=[{host:'codex',lastSeenAt:now,calls:5}];
 assert.equal((await connectionState('codex',{...options,now,live:{hostActivity}})).hostVerified,false);
 const proof={host:'codex',connectionId:installed.installationId,lastSuccessAt:now,lastTool:'connection'};
 const connected=await connectionState('codex',{...options,now,live:{connectionEvidence:[proof]}});
 assert.equal(connected.hostVerified,true);assert.equal(connected.hostIdentity,'caller_declared');assert.equal(connected.nextAction,'ready');
 assert.equal((await connectionState('codex',{...options,now:now+900001,live:{connectionEvidence:[proof]}})).hostVerified,false);
 assert.equal((await installCodex({...options,apply:true,replace:true})).installationId,installed.installationId);
}));
test('WorkBuddy preparation retains its connection identity without claiming host trust',()=>isolated(async options=>{
 const bundle=join(options.dir,'connectors','workbuddy-local'),first=await prepareWorkbuddyBundle(bundle),second=await prepareWorkbuddyBundle(bundle);
 assert.equal(first.installationId,second.installationId);assert.equal(second.changed,false);
 const status=await connectionState('workbuddy',options);assert.equal(status.hostVerified,false);assert.equal(status.steps.find(s=>s.id==='trust').state,'unknown');
}));
test('verified legacy source integration can be removed while identical-name unknown content is retained',()=>isolated(async options=>{
 const installed=await installCodex({...options,apply:true});await rm(join(options.codexHome,'handoffglass-install.json'));
 const result=await uninstallCodex({...options,apply:true});assert.equal(result.legacyVerified,true);assert.equal(result.retained.length,0);
 const config=await readFile(installed.configPath,'utf8');assert.equal(config.trim(),'');await assert.rejects(readFile(installed.skillPath),{code:'ENOENT'});
}));
test('native plugin calls verify tools but do not claim Hook trust or install a duplicate standalone connection',()=>isolated(async options=>{
 const build=await buildCodexPlugin({output:join(options.userHome,'plugin'),envOverrides:{HANDOFFGLASS_CONNECTION_ID:'plugin-test-id'}});
 await mkdir(options.codexHome);
 const configPath=join(options.codexHome,'config.toml');
 const before='model="keep"\n[plugins."'+CODEX_PLUGIN+'"]\nenabled=true\n';
 await writeFile(configPath,before);
 await writeFile(join(options.codexHome,'handoffglass-plugin-install.json'),JSON.stringify({version:1,plugin:CODEX_PLUGIN,installationId:'plugin-test-id',marketplaceRoot:build.marketplaceRoot,command:'codex'}));
 const initial=await connectionState('codex',options);assert.equal(initial.installed,true);assert.equal(initial.nativePlugin,true);assert.equal(initial.hostVerified,false);assert.equal(initial.nextAction,'reload_and_call');
 const now=100000,proof={host:'codex',connectionId:'plugin-test-id',lastSuccessAt:now,lastTool:'connection'};
 const loaded=await connectionState('codex',{...options,now,live:{connectionEvidence:[proof]}});
 assert.equal(loaded.hostVerified,true);assert.equal(loaded.hookTrust,'not_observed');assert.equal(loaded.steps.find(s=>s.id==='trust').state,'unknown');assert.equal(loaded.nextAction,'review_hooks');
 await assert.rejects(installCodex({...options,apply:true}),/native plugin/);assert.equal(await readFile(configPath,'utf8'),before);
 await writeFile(configPath,before.replace('enabled=true','enabled=false'));
 assert.equal((await connectionState('codex',options)).nextAction,'enable_in_host');
}));
