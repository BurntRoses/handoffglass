import test from 'node:test';
import assert from 'node:assert/strict';
import { claudeConfig, codexConfig } from '../src/config.mjs';

test('MCP JSON contains a valid executable and absolute entry path', () => {
  const result = JSON.parse(claudeConfig({ command: '/usr/local/bin/node', entry: '/Users/test/handoff glass/src/mcp.mjs' }));
  assert.deepEqual(result.mcpServers.handoffglass, {
    command: '/usr/local/bin/node', args: ['/Users/test/handoff glass/src/mcp.mjs']
  });
});
test('Codex config quotes Windows paths and embedded spaces', () => {
  const cfg = codexConfig({ command: 'C:\\Program Files\\nodejs\\node.exe', entry: 'C:\\Users\\Dev\\Handoff Glass\\src\\mcp.mjs' });
  assert.match(cfg, /^\[mcp_servers\.handoffglass\]/);
  assert.ok(cfg.includes(JSON.stringify('C:\\Program Files\\nodejs\\node.exe')));
  assert.ok(cfg.includes(JSON.stringify('C:\\Users\\Dev\\Handoff Glass\\src\\mcp.mjs')));
});
