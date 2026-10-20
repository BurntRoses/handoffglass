import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeHostJson, mergeHostToml } from '../src/host-install.mjs';
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
test('Codex TOML install adds the MCP stanza and preserves all unrelated settings', () => {
  const existing = 'model = "gpt-5"\n\n[mcp_servers.files]\ncommand = "files"\n';
  const merged = mergeHostToml(existing);
  assert.match(merged, /model = "gpt-5"/);
  assert.match(merged, /\[mcp_servers\.files\]/);
  assert.match(merged, /\[mcp_servers\.handoffglass\]/);
  assert.throws(() => mergeHostToml(merged), /already configured/);
  const replaced = mergeHostToml(merged, { replace:true, configOptions:{ compact:true } });
  assert.match(replaced, /HANDOFFGLASS_OUTPUT = "compact"/);
  assert.equal((replaced.match(/\[mcp_servers\.handoffglass\]/g) || []).length, 1);
  const nested = '[mcp_servers.handoffglass]\ncommand = "old"\n\n[mcp_servers.handoffglass.env]\nOLD = "value"\n\n[notice]\ncolor = "blue"\n';
  const updated = mergeHostToml(nested, { replace:true });
  assert.equal((updated.match(/\[mcp_servers\.handoffglass\.env\]/g) || []).length, 1);
  assert.equal(updated.includes('OLD = "value"'), false);
  assert.match(updated, /\[notice\]\ncolor = "blue"/);
});
test('TOML merging refuses hidden, inline, malformed or multiline edits to unrelated values', () => {
  assert.throws(() => mergeHostToml('[mcp_servers."handoffglass"]\ncommand="x"\n'),/already configured/);
  assert.throws(() => mergeHostToml('[mcp_servers."handoffglass"]\ncommand="x"\n',{replace:true}),/no automatic rewrite/);
  assert.throws(() => mergeHostToml('mcp_servers = { handoffglass = { command="x" } }\n',{replace:true}),/no automatic rewrite/);
  assert.throws(() => mergeHostToml('bad = [\n'),/./);
  const multiline = 'note = """\n[mcp_servers.handoffglass]\nkeep me\n"""\n';
  assert.throws(() => mergeHostToml(multiline),/no automatic rewrite/);
  const reordered = '[mcp_servers.handoffglass.env]\nOLD="x"\n[other]\nkeep=true\n[mcp_servers.handoffglass]\ncommand="x"\n';
  const result = mergeHostToml(reordered,{replace:true});
  assert.equal(result.includes('OLD='),false);
  assert.match(result,/\[other\]\nkeep=true/);
});
