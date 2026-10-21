#!/usr/bin/env node
/** Offline publication gate; never installs or reads a user's host configuration. */
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { assessPublicRelease, PREVIEW_TARGETS } from '../src/release-contract.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.some(arg => !['--public', '--preview'].includes(arg)) || args.includes('--public') && args.includes('--preview')) {
  console.error('Usage: npm run release:check -- [--preview|--public]'); process.exit(2);
}
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const status = JSON.parse(await readFile(join(root, 'docs/release-status.json'), 'utf8'));
if (status.schemaVersion !== 1 || status.channel !== 'engineering-preview') throw new Error('Unsupported release status schema/channel');
const licenseText = await readFile(join(root, 'LICENSE'), 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
for (const item of Object.values(status.evidence)) {
  if (!['pending', 'verified'].includes(item.status)) throw new Error('Invalid release evidence');
  if (item.record) {
    const path = resolve(root, item.record);
    if (!path.startsWith(resolve(root) + '/') && !path.startsWith(resolve(root) + '\\')) throw new Error('Evidence must be inside the repository');
    await access(path);
  }
}
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
if (pkg.devDependencies['electron-builder'] !== '26.15.3' || lock.packages['node_modules/electron-builder']?.version !== '26.15.3')
  throw new Error('Desktop builder must be pinned in package.json and package-lock.json');
const result = { schemaVersion: 1, version: pkg.version, channel: status.channel, targets: PREVIEW_TARGETS,
  ...assessPublicRelease({ license: pkg.license, licenseText, evidence: status.evidence }),
  automaticUpdates: false, npmPublished: false, workbuddyMarketplacePublished: false,
  evidence: status.evidence };
console.log(JSON.stringify(result, null, 2));
if (args.includes('--public') && !result.publicReady) process.exitCode = 1;
