import { randomUUID } from 'node:crypto';
import { GroundingError } from './grounding.mjs';

/** Opaque references are scoped to the observing client and display layout. */
export class TargetRegistry {
  constructor({ now = () => Date.now(), ttlMs = 300000, limit = 192 } = {}) {
    this.now = now; this.ttlMs = ttlMs; this.limit = limit; this.entries = new Map();
  }
  add(owner, query, layout) {
    const id = `target_${randomUUID()}`;
    this.entries.set(id, { owner, query: structuredClone(query), layout, until: this.now() + this.ttlMs });
    while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value);
    return id;
  }
  get(id, owner, layout) {
    const record = this.entries.get(id);
    if (!record || record.owner !== owner || record.until < this.now() || record.layout !== layout)
      throw new GroundingError('target_ref_expired', 'Observe the current application to obtain a fresh targetRef.');
    return structuredClone(record.query);
  }
  clear() { this.entries.clear(); }
}
