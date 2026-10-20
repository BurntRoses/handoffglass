import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm,readdir,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {parse} from 'smol-toml';
import {installCodex} from '../src/codex-install.mjs';

test('Codex connection installs discoverable skill and one server, preserves other config and backs up replacements',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'hg-codex-install-'));
  try {
    const options={userHome:dir,codexHome:join(dir,'custom-codex'),configOptions:{compact:true}};
    const plan=await installCodex(options);
    assert.equal(plan.applied,false);
    assert.deepEqual(await readdir(dir),[],'Preview must not create directories');
    await mkdir(dirname(plan.configPath),{recursive:true});
    const original='# personal comment\nmodel = "custom"\n[mcp_servers.other]\ncommand="other"\n';
    await writeFile(plan.configPath,original);
    const result=await installCodex({...options,apply:true});
    const config=await readFile(result.configPath,'utf8');
    assert.ok(config.includes('# personal comment'));
    assert.equal(parse(config).mcp_servers.other.command,'other');
    assert.equal(parse(config).model,'custom');
    assert.equal(parse(config).mcp_servers.handoffglass.env.HANDOFFGLASS_OUTPUT,'compact');
    const skill=await readFile(result.skillPath,'utf8');
    assert.match(skill,/name: visual-handoff/);
    assert.match(skill,/教我清空废纸篓/);
    await assert.rejects(installCodex({...options,apply:true}),/already configured/);
    const again=await installCodex({...options,apply:true,replace:true});
    assert.equal(again.changed,false,'Repeated connect must not churn files or backups');
    const backups=(await readdir(dirname(result.configPath))).filter(name=>name.includes('backup'));
    assert.equal(backups.length,1);
    assert.equal(await readFile(join(dirname(result.configPath),backups[0]),'utf8'),original);
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('Codex connection refuses invalid config and symlinks before installing anything',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'hg-codex-refuse-'));
  try {
    const options={userHome:dir,codexHome:join(dir,'codex'),apply:true,replace:true};
    await mkdir(options.codexHome);
    const config=join(options.codexHome,'config.toml');
    await writeFile(config,'bad = [');
    await assert.rejects(installCodex(options),/malformed/);
    assert.deepEqual((await readdir(dir)).sort(),['codex']);
    await rm(config);
    await writeFile(join(dir,'private'),'untouched');
    await symlink(join(dir,'private'),config);
    await assert.rejects(installCodex(options),/symlink/);
    assert.equal(await readFile(join(dir,'private'),'utf8'),'untouched');
  } finally {await rm(dir,{recursive:true,force:true});}
});
