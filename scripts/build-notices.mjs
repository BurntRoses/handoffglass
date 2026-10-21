#!/usr/bin/env node
/** Bundle attribution for installed runtime packages and the embedded Electron runtime. */
import { readFile, readdir, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { desktopRuntimeStatus } from '../src/local/desktop-runtime.mjs';
const desktop = desktopRuntimeStatus();
if (!desktop.available) throw new Error(`${desktop.code}: ${desktop.recovery || 'Install Electron with npm ci --include=optional'}`);
const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
const sections = ['HandoffGlass — third-party notices\nRuntime dependencies; build-only tools are excluded.'];
for (const [path, info] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b))) {
  if (!path || info.dev || info.optional || info.devOptional) continue;
  const base = resolve(root, path);
  const pkg = JSON.parse(await readFile(join(base, 'package.json'), 'utf8'));
  const names = (await readdir(base)).filter(name => /^(licen[cs]e|copying|notice)(\.|$)/i.test(name));
  if (!names.length) throw new Error(`Runtime attribution missing for ${pkg.name}`);
  sections.push(`${pkg.name}@${pkg.version} (${pkg.license || 'see license text'})`);
  for (const name of names.sort()) sections.push(await readFile(join(base, name), 'utf8'));
}
const output = join(root, 'build', 'notices');
await mkdir(output, { recursive: true });
await writeFile(join(output, 'THIRD_PARTY_NOTICES.txt'), sections.join('\n\n---\n\n') + '\n');
for (const name of ['LICENSE', 'LICENSES.chromium.html'])
  await copyFile(join(root, 'node_modules', 'electron', 'dist', name), join(output, `Electron-${name}`));
console.log('Runtime and Electron/Chromium notices prepared');
