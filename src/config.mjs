import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function configPayload({ command = process.execPath, entry = resolve(root, 'src/mcp.mjs') } = {}) {
  if (!command || !entry) throw new TypeError('A Node executable and MCP entry are required');
  return { command, args: [entry] };
}
export function claudeConfig(options) {
  return JSON.stringify({ mcpServers: { handoffglass: configPayload(options) } }, null, 2);
}
export function codexConfig(options) {
  const { command, args } = configPayload(options);
  // JSON string quoting is also valid for TOML basic strings.
  return `[mcp_servers.handoffglass]\ncommand = ${JSON.stringify(command)}\nargs = [${args.map(x => JSON.stringify(x)).join(', ')}]\n`;
}
