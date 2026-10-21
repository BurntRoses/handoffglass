#!/usr/bin/env node
/** Stage only the current target's verified downloads; never upload raw build directories. */
import { readdir, readFile, lstat, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { validateDownloadNames, packagedRuntime, hashFile, releaseTarget, assessPublicRelease, assertStageContents } from '../src/release-contract.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(process.argv[2] || process.env.HANDOFFGLASS_DIST_DIR || `dist/desktop-${process.platform}-${process.arch}`);
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const verification = JSON.parse(await readFile(join(dist, 'package-verification.json'), 'utf8'));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const runtime = await packagedRuntime(dist);
const built = JSON.parse(await readFile(join(dist, 'build-artifacts.json'), 'utf8'));
if (verification.schemaVersion !== 1 || verification.target !== releaseTarget() || verification.version !== pkg.version ||
    verification.build?.commit !== commit || verification.asarSha256 !== await hashFile(join(runtime.resources, 'app.asar')) ||
    built.schemaVersion !== 1 || built.target !== verification.target || built.version !== pkg.version ||
    built.asarSha256 !== verification.asarSha256 || built.build?.commit !== commit)
  throw new Error('Package verification is missing, stale or belongs to another target; run verify-package first');
const names = validateDownloadNames(await readdir(dist), { version: pkg.version });
const files = [];
for (const name of names) {
  const path = join(dist, name), info = await lstat(path);
  if (!info.isFile() || info.size < 1024 * 1024 || info.mtimeMs + 1000 < verification.asarModifiedMs)
    throw new Error(`Invalid or stale download: ${name}`);
  const sha256 = await hashFile(path);
  if (built.artifacts?.find(file => file.name === name)?.sha256 !== sha256) throw new Error(`Download differs from this build: ${name}`);
  files.push({ name, bytes: info.size, sha256 });
}
const status = JSON.parse(await readFile(join(root, 'docs/release-status.json'), 'utf8'));
const licenseText = await readFile(join(root, 'LICENSE'), 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
const result = { schemaVersion: 1, version: pkg.version, target: releaseTarget(), channel: status.channel,
  ...assessPublicRelease({ license: pkg.license, licenseText, evidence: status.evidence }),
  build: verification.build, packageVerification: verification, artifacts: files };
const stage = join(dist, 'release');
const outputNames = [...names, 'SHA256SUMS.txt', 'release-manifest.json'];
await assertStageContents(stage, outputNames);
await mkdir(stage, { recursive: true });
// A failed copy/hash must never leave a manifest advertising an unchecked download.
await rm(join(stage, 'release-manifest.json'), { force:true });
await rm(join(stage, 'SHA256SUMS.txt'), { force:true });
for (const file of files) {
  await copyFile(join(dist, file.name), join(stage, file.name));
  if (await hashFile(join(stage, file.name)) !== file.sha256) throw new Error('Staged download hash mismatch');
}
await writeFile(join(stage, 'SHA256SUMS.txt'), files.map(f => `${f.sha256}  ${f.name}`).join('\n') + '\n');
await writeFile(join(stage, 'release-manifest.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ stage, ...result }, null, 2));
