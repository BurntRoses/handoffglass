#!/usr/bin/env node
/** Dependency-free synthetic broker core benchmark; not a GUI or LLM performance claim. */
import { performance } from 'node:perf_hooks';
import { HandoffManager } from '../src/core.mjs';
const manager = new HandoffManager({ maxHistory: 200 });
const total = 1000;
const t0 = performance.now();
for (let i = 0; i < total; i++) {
  const args = { mode: 'handoff', title: 'Synthetic', message: 'No real UI is involved', requestId: `benchmark-operation-${i}` };
  const s = manager.show(args, 'benchmark');
  if (manager.show(args, 'benchmark').id !== s.id) throw new Error('Idempotency regression');
  if (manager.resolve(s.id, 'cancelled', 'benchmark').session.status !== 'cancelled') throw new Error('State regression');
}
const ms = performance.now() - t0;
console.log(JSON.stringify({ benchmark: 'synthetic-core-only', rounds: total, elapsedMs: Math.round(ms*100)/100,
  opsPerSecond: Math.round(total*1000/ms), retainedSessions: manager.sessions.size }));
manager.close();
