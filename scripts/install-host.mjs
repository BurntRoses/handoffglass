#!/usr/bin/env node
/** Safe opt-in JSON host configuration: preview by default, backup + atomic merge only with --apply. */
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { readFile, mkdir, lstat, writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { mergeHostJson } from '../src/host-install.mjs';

const args = process.argv.slice(2);
const host = args.find(x => !x.startsWith('--'));
const apply = args.includes('--apply');
const replace = args.includes('--replace');
const compact = args.includes('--compact');
const workAt = args.indexOf('--workspace');
const workspace = workAt < 0 ? process.cwd() : resolve(args[workAt + 1] || '.');
function destination() {
  const home = homedir();
  switch (host) {
    case 'cursor': return join(home, '.cursor', 'mcp.json');
    case 'cline': return join(home, '.cline','data','settings','cline_mcp_settings.json');
    case 'windsurf': return join(home, '.codeium','windsurf','mcp_config.json');
    case 'gemini': return join(home, '.gemini', 'settings.json');
    case 'copilot': return join(home, '.copilot', 'mcp-config.json');
    case 'zed': return join(home, '.config', 'zed', 'settings.json');
    case 'vscode': return join(workspace, '.vscode', 'mcp.json');
    case 'claude':
      if (process.platform === 'darwin') return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      if (process.platform === 'win32' && process.env.APPDATA) return join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json');
      throw new Error('Claude Desktop installer supports macOS and Windows; use configure for Claude Code');
    case 'opencode': throw new Error('OpenCode JSONC may contain comments; use configure.mjs opencode and merge manually');
    default: throw new Error('Host not eligible for JSON installer; use npm run configure for Codex/other hosts');
  }
}
if (!host || args.some(x => x.startsWith('--') && !['--apply','--replace','--compact','--workspace'].includes(x)) ||
    (workAt !== -1 && (!args[workAt+1] || args[workAt+1].startsWith('--')))) {
  console.error('Usage: node scripts/install-host.mjs <cursor|cline|windsurf|gemini|copilot|zed|vscode|claude> [--workspace PATH] [--compact] [--apply] [--replace]');
  process.exit(2);
}
let tmp;
try {
  const file = destination();
  let prior = '';
  let existed = false;
  try {
    const meta = await lstat(file);
    if (!meta.isFile() || meta.isSymbolicLink()) throw new Error('Refusing to edit a symlink or non-file');
    prior = await readFile(file, 'utf8'); existed = true;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const next = mergeHostJson(host, prior, { replace, configOptions:{ compact } });
  console.log(`${apply ? 'Updating' : 'DRY RUN — would update'} ${file}`);
  console.log(`Existing configuration: ${existed ? 'preserved and merged' : 'will be created'}. No other MCP entries are removed.`);
  if (!apply) { console.log('Re-run with --apply to write. No files were modified.'); process.exit(0); }
  await mkdir(dirname(file), { recursive:true, mode:0o700 });
  // Detect intervening changes before writing; never silently clobber a host UI edit.
  const latest = await readFile(file, 'utf8').catch(e => { if (e.code === 'ENOENT') return ''; throw e; });
  if (latest !== prior) throw new Error('Config changed since inspection; retry');
  if (existed) {
    const backup = `${file}.handoffglass-backup-${Date.now()}`;
    await writeFile(backup, prior, { flag:'wx', mode:0o600 });
    console.log(`Private backup created at ${backup}`);
  }
  tmp = join(dirname(file), `.handoffglass-${randomUUID()}.tmp`);
  await writeFile(tmp, next, { flag:'wx', mode:0o600 });
  await rename(tmp, file);
  tmp = undefined;
  console.log('MCP configuration updated. Restart the host application.');
} catch (error) {
  console.error(`Config not changed: ${error.message}`);
  process.exitCode = 1;
} finally { if (tmp) await rm(tmp, { force:true }); }
