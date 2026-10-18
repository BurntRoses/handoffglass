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

import { HOSTS, hostConfig } from '../src/config.mjs';
test('all supported host profiles share a single stdio entry and do not rewrite files', () => {
  const options = { command: '/opt/node 22/bin/node', entry: '/home/u/Hand off/src/mcp.mjs', compact: true };
  for (const host of Object.keys(HOSTS)) {
    const config = hostConfig(host, options);
    if (host === 'codex') {
      assert.match(config, /\[mcp_servers\.handoffglass\]/);
      assert.match(config, /HANDOFFGLASS_OUTPUT = "compact"/);
    } else {
      const object = JSON.parse(config);
      const key = host === 'vscode' ? 'servers' : host === 'zed' ? 'context_servers' : 'mcpServers';
      assert.equal(object[key].handoffglass.command, options.command);
      assert.deepEqual(object[key].handoffglass.args, [options.entry]);
      assert.equal(object[key].handoffglass.env.HANDOFFGLASS_OUTPUT, 'compact');
      if (host === 'vscode') assert.equal(object[key].handoffglass.type, 'stdio');
      if (host === 'gemini') assert.equal(object[key].handoffglass.timeout, 60000);
    }
  }
});
test('invalid host rejected', () => assert.throws(() => hostConfig('mystery'), /Unknown host/));
