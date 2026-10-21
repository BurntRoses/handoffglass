import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { expectedDownloads, validateDownloadNames, assessPublicRelease, hashFile, packagedRuntime, assertStageContents } from '../src/release-contract.mjs';
test('release downloads distinguish platform, architecture and installer type', () => {
  assert.deepEqual(expectedDownloads('0.17.0', 'darwin', 'arm64'), ['HandoffGlass-0.17.0-mac-arm64.zip']);
  assert.deepEqual(expectedDownloads('0.17.0', 'win32', 'x64'), ['HandoffGlass-0.17.0-windows-x64-setup.exe', 'HandoffGlass-0.17.0-windows-x64-portable.exe']);
  assert.throws(() => expectedDownloads('0.17.0', 'linux', 'x64'), /not validated/);
  assert.throws(() => expectedDownloads('../0.17.0', 'darwin', 'x64'), /Invalid/);
});
test('old, missing and mixed-target archives cannot pass download verification', () => {
  const options = { version:'0.17.0', platform:'darwin', arch:'arm64' };
  const current = expectedDownloads(options.version, options.platform, options.arch);
  assert.deepEqual(validateDownloadNames([...current, 'builder-debug.yml'], options), current);
  for (const files of [[], ['HandoffGlass-0.16.0-mac-arm64.zip'], [...current, 'old.zip'], ['HandoffGlass-0.17.0-mac-x64.zip']])
    assert.throws(() => validateDownloadNames(files, options), /Expected only/);
  assert.throws(() => validateDownloadNames(['HandoffGlass-0.17.0-windows-x64-setup.exe'], {version:'0.17.0',platform:'win32',arch:'x64'}), /portable/);
});
test('a build or a license alone does not establish public release acceptance', () => {
  const result = assessPublicRelease({license:'UNLICENSED'});
  assert.equal(result.publicReady, false);
  assert.ok(result.blockers.includes('distribution_license'));
  const evidence = Object.fromEntries(result.blockers.filter(id => id !== 'distribution_license').map(id => [id,{status:'verified',record:'docs/qa/example.md'}]));
  assert.equal(assessPublicRelease({license:'MIT',licenseText:'License text',evidence}).publicReady,true);
  delete evidence.codexHost.record;
  assert.ok(assessPublicRelease({license:'MIT',licenseText:'License text',evidence}).blockers.includes('codexHost'));
});
test('release staging preserves unexpected files and rejects symlinks and directories', async () => {
  const dir = await mkdtemp(join(tmpdir(),'hg-release-'));
  try {
    await writeFile(join(dir,'old.zip'),'user data');
    await assert.rejects(assertStageContents(dir,['new.zip']),/unrelated/);
    await assertStageContents(dir,['old.zip']);
    await mkdir(join(dir,'private-data'));
    await assert.rejects(assertStageContents(dir,['old.zip','private-data']),/unrelated/);
    if (process.platform !== 'win32') {
      const link = join(dir,'stage-link');
      await symlink(dir,link);
      await assert.rejects(assertStageContents(link,[]),/real directory/);
    }
  } finally { await rm(dir,{recursive:true,force:true}); }
});
test('streamed artifact hash matches SHA256 and refuses a directory', async () => {
  const dir = await mkdtemp(join(tmpdir(),'hg-hash-'));
  try {
    const data = Buffer.alloc(3 * 1024 * 1024, 42), path = join(dir,'fixture.zip');
    await writeFile(path,data);
    assert.equal(await hashFile(path),createHash('sha256').update(data).digest('hex'));
    await assert.rejects(hashFile(dir),/regular file/);
    if (process.platform !== 'win32') {
      await symlink(path,join(dir,'link.zip'));
      await assert.rejects(hashFile(join(dir,'link.zip')),/regular file/);
    }
  } finally { await rm(dir,{recursive:true,force:true}); }
});
test('packaged checks select an exact architecture and reject ambiguous build roots', async () => {
  const dir = await mkdtemp(join(tmpdir(),'hg-package-'));
  async function app(folder) {
    const base = join(dir,folder,'HandoffGlass.app','Contents');
    await mkdir(join(base,'MacOS'),{recursive:true});await mkdir(join(base,'Resources'),{recursive:true});
    await writeFile(join(base,'MacOS','HandoffGlass'),'fixture');await writeFile(join(base,'Resources','app.asar'),'fixture');
  }
  try {
    await app('mac-arm64');
    assert.match((await packagedRuntime(dir,{platform:'darwin',arch:'arm64'})).binary,/mac-arm64/);
    await assert.rejects(packagedRuntime(dir,{platform:'darwin',arch:'x64'}),/found 0/);
    await app('mac');await app('mac-x64');
    await assert.rejects(packagedRuntime(dir,{platform:'darwin',arch:'x64'}),/found 2/);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
