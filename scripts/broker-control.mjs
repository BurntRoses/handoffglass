#!/usr/bin/env node
import { runtimeDir, secureRuntimeDir, readManifest, probe } from '../src/runtime.mjs';
const action = process.argv[2] || 'status';
if (!['status', 'stop'].includes(action)) {
  console.error('Usage: node scripts/broker-control.mjs [status|stop]');
  process.exitCode = 2;
} else {
  const dir = await secureRuntimeDir(runtimeDir());
  const info = await readManifest(dir);
  if (!info || !await probe(info)) {
    console.log('HandoffGlass broker is not running.');
  } else if (action === 'status') {
    console.log(`HandoffGlass broker is running. PID ${info.pid} on 127.0.0.1:${info.port}.`);
  } else {
    // Verify the *live* health endpoint and its authenticated PID before signalling.
    process.kill(info.pid, 'SIGTERM');
    console.log(`Asked HandoffGlass broker PID ${info.pid} to stop.`);
  }
}
