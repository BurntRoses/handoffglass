import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeHostJson } from '../src/host-install.mjs';
test('conservatively merges one MCP entry while retaining unrelated host preferences', () => {
  const existing = JSON.stringify({ theme:'dark', mcpServers:{ database:{ command:'python',args:['db.py'] } } });
  const obj = JSON.parse(mergeHostJson('cursor', existing));
  assert.equal(obj.theme, 'dark');
  assert.deepEqual(obj.mcpServers.database,{command:'python',args:['db.py']});
  assert.equal(obj.mcpServers.handoffglass.command, process.execPath);
});
test('requires explicit replacement and rejects malformed or commented configuration', () => {
  const initial = mergeHostJson('gemini','{}');
  assert.throws(() => mergeHostJson('gemini', initial),/already configured/);
  assert.ok(JSON.parse(mergeHostJson('gemini',initial,{replace:true})).mcpServers.handoffglass);
  assert.throws(() => mergeHostJson('cursor','{ // JSONC comment\n }'),/malformed JSON/);
  assert.throws(() => mergeHostJson('vscode','{"servers": []}'),/Invalid existing/);
  assert.throws(() => mergeHostJson('codex','{}'),/uses TOML/);
});
test('VS Code uses servers while Copilot uses portable mcpServers', () => {
  assert.ok(JSON.parse(mergeHostJson('vscode','{}')).servers.handoffglass);
  assert.ok(JSON.parse(mergeHostJson('copilot','{}')).mcpServers.handoffglass);
});
