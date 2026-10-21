#!/usr/bin/env node
import { createRequire } from 'node:module';
import { platform, release } from 'node:os';
import { runtimeDir, readManifest, probe } from '../src/runtime.mjs';
import { desktopRuntimeStatus } from '../src/local/desktop-runtime.mjs';
const require = createRequire(import.meta.url);
const { version } = require('../package.json');
const checks = [];
const major = Number(process.versions.node.split('.')[0]);
checks.push({ label: 'Node.js >= 22', ok: major >= 22, value: process.version });
checks.push({ label: 'macOS or Windows desktop target', ok: ['darwin', 'win32'].includes(platform()), value: `${platform()} ${release()}` });
for (const pkg of ['electron', '@modelcontextprotocol/server', 'smol-toml', 'zod']) {
  let ok = false;
  try { require.resolve(pkg); ok = true; } catch {}
  checks.push({ label: `Dependency: ${pkg}`, ok, value: ok ? 'resolved' : 'npm install required' });
}
console.log(`\nHandoffGlass ${version} · Runtime readiness\n`);
for (const c of checks) console.log(`${c.ok ? '✓' : '!'} ${c.label.padEnd(38)} ${c.value}`);
console.log('\nNote: package resolution and unit tests do not prove actual Electron drawing works on this OS.');
console.log('For a local connection preflight: npm run connection:check\n');
if (major < 22 || !checks.filter(c => c.label === 'Dependency: @modelcontextprotocol/server' || c.label === 'Dependency: zod').every(c => c.ok)) process.exitCode = 1;
console.log('Electron is optional: npm ci --omit=optional for an MCP-only headless installation; npm ci for desktop.');
const desktop = desktopRuntimeStatus();
console.log(`Desktop executable: ${desktop.code}`);
if (desktop.recovery) console.log(desktop.recovery);
if (process.argv.includes('--desktop') && (!desktop.available || !['darwin','win32'].includes(platform()))) process.exitCode = 1;
