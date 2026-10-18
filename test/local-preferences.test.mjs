import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, symlink, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPreferences, savePreferences, resetPreferences, hasUserPreferences, DEFAULT_PREFERENCES, validatePreferences } from '../src/local/preferences.mjs';
const withDir = async fn => { const d=await mkdtemp(join(tmpdir(),'hg-prefs-')); try { await chmod(d,0o700); return await fn(d); } finally { await rm(d,{recursive:true,force:true}); } };
test('local preferences are opt-in and do not write merely by reading',async()=>withDir(async dir=>{
  assert.deepEqual(await loadPreferences(dir),DEFAULT_PREFERENCES);
  assert.equal(await hasUserPreferences(dir),false);
  assert.equal(await readFile(join(dir,'preferences.json')).catch(e=>e.code),'ENOENT');
}));
test('local visual preferences survive restart with user-only file permissions',async()=>withDir(async dir=>{
  const p=await savePreferences({visualStyle:'handdrawn',motion:'off'},dir);
  assert.equal(await hasUserPreferences(dir),true);
  assert.equal(p.visualStyle,'handdrawn');
  assert.equal((await loadPreferences(dir)).motion,'off');
  const contents=await readFile(join(dir,'preferences.json'),'utf8');
  assert.equal(contents.includes('password'),false);
  assert.equal((await resetPreferences(dir)).visualStyle,'luminous');
  assert.equal(await hasUserPreferences(dir),false);
}));
test('memory layer rejects unknown data fields to avoid storing session content',()=>{
  for(const obj of [{password:'secret'},{history:[1]},{windowTitle:'Sensitive document'}, {motion:'spin'},{version:999}])
    assert.throws(()=>validatePreferences(obj));
});
test('refuses symbolic-link preference file',async()=>withDir(async dir=>{
  const target=join(dir,'secret.txt');await writeFile(target,'{}');
  await symlink(target,join(dir,'preferences.json'));
  await assert.rejects(()=>loadPreferences(dir),/Invalid preferences/);
}));

test('locale and density preferences are validated for bilingual desktop UI',()=>{
 assert.deepEqual(validatePreferences({locale:'en-US',density:'compact'}).locale,'en-US');
 assert.throws(()=>validatePreferences({density:'ultra'}));
});
