/** Declarative facts about HOST INTEGRATION, not claims about model quality. */
const MCP = Object.freeze({ protocol:'mcp-stdio', invocation:'tool', localDesktop:true, tested:'schema-only' });
export const HOST_CAPABILITIES = Object.freeze({
  claude:{ ...MCP, entry:'mcpServers', mode:'desktop-or-cli' },
  codex:{ ...MCP, entry:'mcp_servers', mode:'cli-or-ide' },
  cursor:{ ...MCP, entry:'mcpServers', mode:'ide' },
  vscode:{ ...MCP, entry:'servers', mode:'ide' },
  copilot:{ ...MCP, entry:'mcpServers', mode:'cli-or-ide' },
  gemini:{ ...MCP, entry:'mcpServers', mode:'cli' },
  zed:{ ...MCP, entry:'context_servers', mode:'ide' },
  cline:{ ...MCP, entry:'mcpServers', mode:'ide-or-cli' },
  windsurf:{ ...MCP, entry:'mcpServers', mode:'ide' },
  opencode:{ ...MCP, entry:'mcp.local.command', mode:'cli-or-desktop' },
  trae:{ ...MCP, entry:'mcpServers', mode:'ide' },
  workbuddy:{ ...MCP, entry:'mcpServers', mode:'desktop', connector:'mcp+skill' },
  deepseek:{ ...MCP, entry:'mcpServers', mode:'desktop-or-cli', nativePlugin:'cordis' },
  'doubao-app':{ protocol:'none-verified', invocation:'unsupported', localDesktop:false, tested:'unsupported' }
});
export function capability(host) {
  if (!Object.hasOwn(HOST_CAPABILITIES,host)) throw new TypeError('Unknown host');
  return {host,...HOST_CAPABILITIES[host]};
}
export function hostStrategy(host, { remote = false } = {}) {
  const s=capability(host);
  if(s.invocation==='unsupported') return {host, viable:false, reason:'No verified plugin/MCP interface for this product'};
  if(remote) return {host, viable:false, reason:'Remote/cloud harness cannot reach an arbitrary local desktop by stdio without an explicit trusted bridge'};
  return {host, viable:true, transport:s.protocol, toolset:'standard', optionalMemory:'user-preferences-only', requiresLocalDesktop:true};
}
