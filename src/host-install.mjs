/** Pure, conservative merge plan for JSON MCP hosts; no filesystem effects. */
import { hostConfig } from './config.mjs';
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
