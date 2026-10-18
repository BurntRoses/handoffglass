import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
test('WorkBuddy local MCP connector includes one stdio server and bilingual metadata',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hg-wb-'));
 try{
  const run=spawnSync(process.execPath,['scripts/build-workbuddy.mjs',dir],{cwd:root,encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const mc=JSON.parse(await readFile(join(dir,'mcp.json'),'utf8'));
  assert.deepEqual(Object.keys(mc.mcpServers),['handoffglass']);
  assert.equal(mc.mcpServers.handoffglass.type,'stdio');
  assert.equal(mc.mcpServers.handoffglass.runtime.version,'22');
  const meta=JSON.parse(await readFile(join(dir,'connector-meta.json'),'utf8'));
  assert.equal(meta.type,'mcp');assert.ok(meta.description_zh);
  const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
  assert.equal(meta.version,pkg.version,'Generated connector must match package release version');
  assert.match(await readFile(join(dir,'skills/visual-handoff/SKILL.md'),'utf8'),/handoff/i);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('DeepSeek Cordis source exports a real tool registration and requires explicit project checkout',async()=>{
 const code=await readFile(new URL('../integrations/deepseek-harness/src/plugin.ts',import.meta.url),'utf8');
 assert.match(code,/ctx\.tools\.register\(defineTool/);
 assert.match(code,/handoffglass_guide/);
 assert.match(code,/handoffglass_check/);
 assert.match(code,/handoffglass_wait/);
 assert.match(code,/bridge\.wait\(args\.sessionId, seconds\)/);
 assert.match(code,/verified:false/);
});
test('DeepSeek installer generates valid source-root patch with no magic user path',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'hg-dsh-'));
  try {
    await writeFile(join(folder,'pnpm-workspace.yaml'),'packages:\n  - "packages/*"\n');
    const cmd=spawnSync(process.execPath,['scripts/prepare-deepseek.mjs',folder],{cwd:root,encoding:'utf8'});
    assert.equal(cmd.status,0,cmd.stderr);
    const patch=await readFile(join(folder,'scratch-handoffglass/cordis.yml'),'utf8');
    const plugin=await readFile(join(folder,'scratch-handoffglass/src/plugin.ts'),'utf8');
    assert.match(patch,/insert:/);assert.match(plugin,/file:\/\//);
    assert.doesNotMatch(plugin,/__HANDOFFGLASS_RUNTIME__/);
    assert.match(plugin,/ctx\.tools\.register/);
    assert.match(plugin,/handoffglass_wait/);
  } finally {await rm(folder,{recursive:true,force:true});}
});
