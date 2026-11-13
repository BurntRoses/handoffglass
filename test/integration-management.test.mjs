import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parse} from 'smol-toml';
import {INTEGRATION_HOSTS,installIntegration,setIntegrationEnabled,integrationStatus} from '../src/integration-lifecycle.mjs';
import {connectionState} from '../src/connection-state.mjs';
import {MANAGED_HOSTS} from '../src/desktop/host-connections.mjs';
test('UI and MCP management cover the same seven integrations without installing during preview',async()=>{
 assert.deepEqual(new Set(MANAGED_HOSTS),new Set(INTEGRATION_HOSTS));
 const home=await mkdtemp(join(tmpdir(),'hg-management-'));
 try{
  const options={userHome:home,home,dir:join(home,'runtime'),codexHome:join(home,'codex')};
  for(const host of INTEGRATION_HOSTS){
   const state=await integrationStatus(host,options);assert.equal(state.cleanupAvailable,false,host);
   assert.equal((await connectionState(host,options)).hostVerified,false,host);
  }
  const preview=await installIntegration('codex',options);assert.equal(preview.applied,false);assert.equal(preview.confirmationRequired,true);
  await assert.rejects(readFile(join(home,'codex','config.toml')),{code:'ENOENT'});
 }finally{await rm(home,{recursive:true,force:true});}
});
test('Codex connection switch preserves approval policy, personal settings and disabled state',async()=>{
 const home=await mkdtemp(join(tmpdir(),'hg-plugin-switch-'));
 try{
  const options={userHome:home,codexHome:join(home,'codex'),dir:join(home,'runtime')};await mkdir(options.codexHome);
  const path=join(options.codexHome,'config.toml');
  const before='# personal\nmodel="keep"\n[plugins."handoffglass@handoffglass-local"]\nenabled=true # keep\n[plugins."handoffglass@handoffglass-local".mcp_servers.handoffglass]\ndefault_tools_approval_mode="prompt"\n[plugins.other]\nenabled=true\n';
  await writeFile(path,before);await writeFile(join(options.codexHome,'handoffglass-plugin-install.json'),JSON.stringify({version:1,plugin:'handoffglass@handoffglass-local',marketplaceRoot:join(home,'bundle'),installationId:'test'}));
  const disabled=await setIntegrationEnabled(false,{host:'codex',...options});assert.equal(disabled.enabled,false);assert.equal(disabled.reloadRequired,true);
  const expected=parse(before);expected.plugins['handoffglass@handoffglass-local'].enabled=false;
  assert.deepEqual(parse(await readFile(path,'utf8')),expected);
  assert.match(await readFile(path,'utf8'),/# keep/);
  await setIntegrationEnabled(true,{host:'codex',...options});assert.equal(await readFile(path,'utf8'),before);
 }finally{await rm(home,{recursive:true,force:true});}
});
test('WorkBuddy imported connection enablement stays with its host',async()=>{
 const state=await setIntegrationEnabled(false,{host:'workbuddy'});
 assert.equal(state.applied,false);assert.equal(state.nextAction,'disable_in_workbuddy');
});
