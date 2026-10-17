#!/usr/bin/env node
/** Prints paste-ready configs; deliberately NEVER edits existing client settings. */
import { claudeConfig, codexConfig } from '../src/config.mjs';
const flag = process.argv[2] || 'all';
if (!['all', 'claude', 'codex'].includes(flag)) {
  console.error('Usage: node scripts/configure.mjs [all|claude|codex]');
  process.exitCode = 2;
} else {
  if (flag !== 'codex') {
    console.log('=== MCP JSON (Claude Desktop and compatible hosts) ===\n' + claudeConfig() + '\n');
  }
  if (flag !== 'claude') {
    console.log('=== Codex config.toml fragment ===\n' + codexConfig());
  }
  console.log('Paste into the EXISTING host config; merge without deleting other MCP servers. Restart the host.');
  console.log('For the first on-screen prompt, you must run on the same interactive desktop as Electron.');
}
