#!/usr/bin/env node
/** Print merge-ready host configs without modifying the user's existing settings. */
import { hostConfig, HOSTS } from '../src/config.mjs';
const args = process.argv.slice(2);
const compact = args.includes('--compact');
const hosts = args.filter(x => !x.startsWith('--'));
if (args.some(x => x.startsWith('--') && x !== '--compact') || (hosts.length && hosts.some(x => x !== 'all' && !Object.hasOwn(HOSTS, x)))) {
  console.error(`Usage: node scripts/configure.mjs [${Object.keys(HOSTS).join('|')}|all] [--compact]`);
  process.exitCode = 2;
} else {
  const selected = hosts.length === 0 || hosts.includes('all') ? Object.keys(HOSTS) : [...new Set(hosts)];
  for (const host of selected) console.log(`=== ${HOSTS[host].label} (${host}) ===\n${hostConfig(host, { compact })}\n`);
  console.log('Merge only the handoffglass entry into your existing host settings. Do not overwrite other MCP servers.');
  console.log('This stdio MCP requires Node.js >=22 running on the same interactive desktop as the overlay.');
  if (compact) console.log('Compact output limits per-tool JSON response size; it does not change permissions.');
}
