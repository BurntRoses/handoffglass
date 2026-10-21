#!/usr/bin/env node
/** Inspect the exact packaged runtime. Structural verification, not native GUI acceptance. */
import { readFile, access, stat, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { packagedRuntime, hashFile, releaseTarget } from '../src/release-contract.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(process.argv[2] || process.env.HANDOFFGLASS_DIST_DIR || `dist/desktop-${process.platform}-${process.arch}`);
const runtime = await packagedRuntime(dist);
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const run = promisify(execFile);
const { stdout: commit } = await run('git', ['rev-parse', 'HEAD'], { cwd: root });
const script = `
 const fs = require('node:fs');
 const path = require('node:path');
 const resources = ${JSON.stringify(runtime.resources)};
 const base = path.join(resources, 'app.asar');
 const pkg = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf8'));
 for (const name of ['LICENSE', 'NOTICE', 'src/mcp.mjs', 'src/desktop/app.mjs', 'src/capabilities.mjs',
   'skills/visual-handoff/SKILL.md', 'skills/visual-handoff/references/tool-contracts.md',
   'integrations/workbuddy/connector-meta.json', 'integrations/workbuddy/icon.svg',
   'node_modules/@modelcontextprotocol/server/package.json', 'node_modules/zod/package.json', 'node_modules/smol-toml/package.json']) fs.accessSync(path.join(base,name));
 for (const name of ['THIRD_PARTY_NOTICES.txt', 'Electron-LICENSE', 'Electron-LICENSES.chromium.html'])
   if (fs.statSync(path.join(resources,'notices',name)).size === 0) throw new Error('Empty license notice');
 for (const name of ['.env', '.git', 'dist', '.tmp', 'handoffglass-install.json', 'node_modules/electron', 'node_modules/electron-builder'])
   if (fs.existsSync(path.join(base,name))) throw new Error('Private/development files in package');
 process.stdout.write(JSON.stringify({version:pkg.version,license:pkg.license,build:pkg.handoffglassBuild,arch:process.arch}));
`;
const { stdout } = await run(runtime.binary, ['-e', script], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, timeout: 30000, maxBuffer: 1024 * 1024
});
const embedded = JSON.parse(stdout);
if (embedded.version !== pkg.version || embedded.license !== pkg.license || embedded.build?.version !== pkg.version || embedded.build?.commit !== commit.trim() || embedded.arch !== process.arch)
  throw new Error('Packaged version, source commit or runtime architecture does not match this checkout');
const native = join(runtime.resources, 'native', process.platform === 'darwin' ? 'hg-locate' : 'locate.ps1');
await access(native);
if (process.platform === 'darwin') {
  const { stdout: architectures } = await run('lipo', ['-archs', native]);
  if (!architectures.trim().split(/\s+/).includes(process.arch === 'x64' ? 'x86_64' : process.arch)) throw new Error('Native helper architecture does not match the app');
}
const asar = join(runtime.resources, 'app.asar');
const result = { schemaVersion: 1, mode: 'structural-only', target: releaseTarget(), version: pkg.version,
  build: embedded.build, asarSha256: await hashFile(asar), asarModifiedMs: (await stat(asar)).mtimeMs,
  noticesIncluded: true, verifiedAt: new Date().toISOString() };
await writeFile(join(dist, 'package-verification.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
