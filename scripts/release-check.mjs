#!/usr/bin/env node
/** Offline publication gate; never installs or reads a user's host configuration. */
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join, relative, isAbsolute, sep } from 'node:path';
import { assessPublicRelease, PREVIEW_TARGETS } from '../src/release-contract.mjs';
import { validateHostEvidenceMatrix, validateHostEvidenceRecord } from '../src/host-evidence.mjs';
import { DESKTOP_EVIDENCE_CHECKS, validateDesktopEvidenceRecord } from '../src/desktop-evidence.mjs';
const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
async function recordPath(record) {
  if(typeof record!=='string')throw new Error('Evidence must reference a repository record');
  const path=await realpath(resolve(root,record)),local=relative(root,path);
  if(!local||local==='..'||local.startsWith('..'+sep)||isAbsolute(local))throw new Error('Evidence must be inside the repository');
  return path;
}
const args = process.argv.slice(2);
if (args.some(arg => !['--public', '--preview', '--plugin'].includes(arg)) || args.includes('--public') && args.includes('--preview')) {
  console.error('Usage: npm run release:check -- [--preview|--public] [--plugin]'); process.exit(2);
}
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const status = JSON.parse(await readFile(join(root, 'docs/release-status.json'), 'utf8'));
if (status.schemaVersion !== 1 || status.channel !== 'engineering-preview') throw new Error('Unsupported release status schema/channel');
const licenseText = await readFile(join(root, 'LICENSE'), 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
const delivery=args.includes('--plugin')?'plugin':'desktop';
const hostStatus=delivery==='plugin'?JSON.parse(await readFile(join(root,'docs/host-evidence.json'),'utf8')):null;
if(hostStatus){
  const hostErrors=validateHostEvidenceMatrix(hostStatus);
  if(hostErrors.length)throw new Error('Invalid host evidence matrix:\n'+hostErrors.join('\n'));
}
for (const [kind,item] of Object.entries(status.evidence)) {
  if (!['pending', 'verified'].includes(item.status)) throw new Error('Invalid release evidence');
  if (item.record) {
    const path = await recordPath(item.record);
    if (Object.hasOwn(DESKTOP_EVIDENCE_CHECKS,kind)) {
      const record=JSON.parse(await readFile(path,'utf8')),errors=validateDesktopEvidenceRecord(record,{kind});
      if(errors.length)throw new Error(`Invalid desktop evidence record ${kind}:\n${errors.join('\n')}`);
    }
  }
}
for(const [host,item] of Object.entries(hostStatus?.hosts||{})){
  if(!['unverified','verified'].includes(item.status))throw new Error('Invalid host acceptance status');
  if(item.record){
    const path=await recordPath(item.record);
    const record=JSON.parse(await readFile(path,'utf8')),errors=validateHostEvidenceRecord(record,{host});
    if(errors.length)throw new Error(`Invalid host evidence record ${host}:\n${errors.join('\n')}`);
  }
}
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
if (pkg.devDependencies['electron-builder'] !== '26.15.3' || lock.packages['node_modules/electron-builder']?.version !== '26.15.3')
  throw new Error('Desktop builder must be pinned in package.json and package-lock.json');
const result = { schemaVersion: 1, version: pkg.version, channel: status.channel, delivery, targets: PREVIEW_TARGETS,
  ...assessPublicRelease({ license: pkg.license, licenseText, evidence: status.evidence, delivery, hostEvidence:hostStatus?.hosts }),
  automaticUpdates: false, npmPublished: false, workbuddyMarketplacePublished: false,
  evidence: status.evidence, ...(hostStatus?{hostEvidence:hostStatus.hosts}:{}),signingRequired:delivery==='desktop' };
console.log(JSON.stringify(result, null, 2));
if (args.includes('--public') && !result.publicReady) process.exitCode = 1;
