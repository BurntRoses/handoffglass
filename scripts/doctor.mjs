#!/usr/bin/env node
import { createRequire } from 'node:module';
import { platform, release } from 'node:os';
import { runtimeDir, readManifest, probe } from '../src/runtime.mjs';
const require = createRequire(import.meta.url);
const checks = [];
const major = Number(process.versions.node.split('.')[0]);
checks.push({ label: 'Node.js >= 22', ok: major >= 22, value: process.version });
checks.push({ label: 'macOS or Windows desktop target', ok: ['darwin', 'win32'].includes(platform()), value: `${platform()} ${release()}` });
for (const pkg of ['electron', '@modelcontextprotocol/server', '@modelcontextprotocol/client', 'zod']) {
  let ok = false;
  try { require.resolve(pkg); ok = true; } catch {}
  checks.push({ label: `Dependency: ${pkg}`, ok, value: ok ? 'resolved' : 'npm install required' });
}
console.log('\nHandoffGlass 0.4 · Runtime readiness\n');
for (const c of checks) console.log(`${c.ok ? '✓' : '!'} ${c.label.padEnd(38)} ${c.value}`);
console.log('\nNote: package resolution and unit tests do not prove actual Electron drawing works on this OS.');
console.log('Try the MCP SDK integration smoke with: npm run test:integration\n');
if (major < 22 || !checks.filter(c => c.label === 'Dependency: @modelcontextprotocol/server' || c.label === 'Dependency: zod').every(c => c.ok)) process.exitCode = 1;
console.log('Electron is optional: npm ci --omit=optional for an MCP-only headless installation; npm ci for desktop.');
