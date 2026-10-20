/** Ephemeral, bounded evidence that an authenticated local MCP client actually called a tool.
 * A host name is only a caller-declared config label, never authenticated host identity.
 * No session IDs, arguments, paths, UI text or user identifiers are retained.
 */
import { HOSTS } from '../config.mjs';
export const ACTIVITY_TTL_MS = 15 * 60_000;
const MAX_HOSTS = 16;
const HOST_IDS = new Set(Object.keys(HOSTS));
export function classifyHost(value) {
  return typeof value === 'string' && HOST_IDS.has(value) ? value : 'unidentified';
}
export class HostActivity {
  constructor({ now = () => Date.now() } = {}) { this.now = now; this.hosts = new Map(); }
  record(declaredHost, endpoint) {
    if (typeof endpoint !== 'string' || !/^\/agent\/(displays|inspect|show|locate|status|wait|events|cancel|scene|context|blueprint)$/.test(endpoint)) return;
    const host = classifyHost(declaredHost), at = this.now();
    this.#prune(at);
    const previous = this.hosts.get(host);
    this.hosts.delete(host);
    this.hosts.set(host, { host, lastSeenAt: at, calls: Math.min(9999, (previous?.calls || 0) + 1),
      // Last action is a fixed code, NOT caller-supplied content.
      lastAction: endpoint.slice(7) });
    while (this.hosts.size > MAX_HOSTS) this.hosts.delete(this.hosts.keys().next().value);
  }
  #prune(now) {
    for (const [host, data] of this.hosts) if (now < data.lastSeenAt || now - data.lastSeenAt > ACTIVITY_TTL_MS) this.hosts.delete(host);
  }
  snapshot() {
    const now = this.now(); this.#prune(now);
    return [...this.hosts.values()].reverse().map(entry => ({ ...entry }));
  }
}
