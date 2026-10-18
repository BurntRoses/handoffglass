/** Host-specific configuration shapes with ONE common stdio executable. No host SDK dependency. */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const HOSTS = Object.freeze({
  claude: { label: 'Claude Desktop / Claude Code', family: 'mcpServers' },
  codex: { label: 'OpenAI Codex CLI / IDE', family: 'toml' },
  cursor: { label: 'Cursor', family: 'mcpServers' },
  vscode: { label: 'VS Code', family: 'servers' },
  copilot: { label: 'GitHub Copilot CLI / agent harness', family: 'mcpServers' },
  gemini: { label: 'Gemini CLI', family: 'mcpServers' },
  zed: { label: 'Zed editor', family: 'context_servers' },
  cline: { label: 'Cline extension and CLI', family: 'mcpServers' },
  windsurf: { label: 'Windsurf / Cascade', family: 'mcpServers' },
  opencode: { label: 'OpenCode CLI and desktop', family: 'opencode' },
  trae: { label: 'TRAE IDE / SOLO (MCP-supported mode)', family: 'mcpServers' },
  workbuddy: { label: 'Tencent WorkBuddy (local MCP)', family: 'mcpServers' },
  deepseek: { label: 'DeepSeek Harness (MCP fallback)', family: 'mcpServers' },
});
export function configPayload({ command = process.execPath, entry = resolve(root, 'src/mcp.mjs'), compact = false, envOverrides = {} } = {}) {
  if (typeof command !== 'string' || !command || typeof entry !== 'string' || !entry) {
    throw new TypeError('A Node executable and MCP entry are required');
  }
  return {
    command, args: [entry],
    ...((compact || Object.keys(envOverrides).length) ? { env: { ...(compact ? { HANDOFFGLASS_OUTPUT: 'compact' } : {}), ...envOverrides } } : {})
  };
}
export function hostConfig(host, options = {}) {
  const spec = HOSTS[host];
  if (!spec) throw new TypeError(`Unknown host: ${host}`);
  const entry = configPayload(options);
  if (spec.family === 'toml') {
    // JSON-quoted UTF-8 strings are valid TOML basic strings, including Windows paths.
    const env = entry.env ? `\n[mcp_servers.handoffglass.env]\n${Object.entries(entry.env).map(([k,v]) => `${k} = ${JSON.stringify(v)}`).join('\n')}\n` : '';
    return `[mcp_servers.handoffglass]\ncommand = ${JSON.stringify(entry.command)}\nargs = [${entry.args.map(x => JSON.stringify(x)).join(', ')}]\n${env}`;
  }
  if (spec.family === 'opencode') {
    return JSON.stringify({ mcp: { handoffglass: { type:'local', command:[entry.command,...entry.args],
      enabled:true, ...(entry.env ? { environment:entry.env } : {}) } } }, null, 2);
  }
  const payload = spec.family === 'servers' ? { type: 'stdio', ...entry } : entry;
  if (host === 'gemini') payload.timeout = 60000; // handoff_wait can consume 30 sec
  return JSON.stringify({ [spec.family]: { handoffglass: payload } }, null, 2);
}
export const claudeConfig = options => hostConfig('claude', options);
export const codexConfig = options => hostConfig('codex', options);
