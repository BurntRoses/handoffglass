/** Pure, conservative merge plan for JSON MCP hosts; no filesystem effects. */
import { hostConfig } from './config.mjs';
import { parse } from 'smol-toml';
import { isDeepStrictEqual } from 'node:util';
export function mergeHostJson(host, existing = '', { replace = false, configOptions = {} } = {}) {
  if (host === 'codex') throw new Error('Codex uses TOML; print and merge its stanza manually');
  const newRoot = JSON.parse(hostConfig(host, configOptions));
  const field = Object.keys(newRoot)[0];
  let current;
  try { current = existing.trim() ? JSON.parse(existing) : {}; }
  catch { throw new Error('Existing config contains JSONC/comments or malformed JSON; no automatic rewrite'); }
  if (!current || Array.isArray(current) || typeof current !== 'object') throw new Error('Existing config must be an object');
  const servers = current[field] ?? {};
  if (!servers || Array.isArray(servers) || typeof servers !== 'object') throw new Error('Invalid existing MCP host configuration');
  if (Object.hasOwn(servers, 'handoffglass') && !replace) {
    throw new Error('handoffglass is already configured; use --replace to update deliberately');
  }
  const updated = { ...current, [field]: { ...servers, ...newRoot[field] } };
  return JSON.stringify(updated, null, 2) + '\n';
}

/** Merge only the HandoffGlass table; preserve every other Codex TOML setting. */
export function mergeHostToml(existing = '', { replace = false, configOptions = {} } = {}) {
  if (typeof existing !== 'string') throw new TypeError('Existing TOML must be text');
  let current;
  try { current = parse(existing); }
  catch { throw new Error('Existing Codex TOML is malformed; no automatic rewrite'); }
  if (Object.hasOwn(current.mcp_servers ?? {},'handoffglass') && !replace)
    throw new Error('handoffglass is already configured; use --replace to update deliberately');
  const stanza = hostConfig('codex', configOptions).trimEnd();
  const expected = current;
  expected.mcp_servers ??= Object.create(null);
  if (!expected.mcp_servers || typeof expected.mcp_servers !== 'object' || Array.isArray(expected.mcp_servers))
    throw new Error('Invalid existing MCP host configuration');
  expected.mcp_servers.handoffglass = parse(stanza).mcp_servers.handoffglass;
  // Only standard generated tables can be replaced without rewriting comments.
  // A complete parser checks that textual slicing changes no unrelated value.
  const lines = existing.split(/(?<=\n)/);
  const kept = [];
  let omit = false;
  for (const line of lines) {
    if (/^[ \t]*\[/.test(line))
      omit = /^[ \t]*\[mcp_servers\.handoffglass(?:\.[A-Za-z0-9_-]+)*\][ \t]*(?:#.*)?(?:\r?\n)?$/.test(line);
    if (!omit) kept.push(line);
  }
  const remaining = kept.join('').trimEnd();
  const next = `${remaining}${remaining ? '\n\n' : ''}${stanza}\n`;
  let actual;
  try { actual = parse(next); }
  catch { throw new Error('Nonstandard HandoffGlass TOML layout; no automatic rewrite'); }
  if (!isDeepStrictEqual(actual, expected)) throw new Error('TOML merge would change unrelated settings; no automatic rewrite');
  return next;
}
