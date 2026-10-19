#!/usr/bin/env node
/** Real AX + Broker + overlay regression. Keep the fixture foreground for 20s. */
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { BrokerClient, readManifest, probe } from '../src/runtime.mjs';
import { savePreferences } from '../src/local/preferences.mjs';

assert.equal(process.platform, 'darwin', 'This native fixture requires macOS');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = await mkdtemp(join(tmpdir(), 'handoffglass-native-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const target = { app: 'HandoffGlassQATarget', role: 'button', name: 'Locate target' };
// Opt in only inside the disposable test Broker. Never change the user's saved
// consent or grant OS permissions; an untrusted helper must fail this check.
const env = { ...process.env, HANDOFFGLASS_RUNTIME_DIR: dir,
  HANDOFFGLASS_HEADLESS: '0', HANDOFFGLASS_ENABLE_ACCESSIBILITY: '1' };
delete env.ELECTRON_RUN_AS_NODE;
const broker = new BrokerClient({ env });
let child, sessionId;
const completed = [];
try {
  await savePreferences({}, dir);
  await promisify(execFile)(process.execPath, [join(root, 'scripts/build-native-macos.mjs')]);
  const contents = join(dir, 'HandoffGlassQATarget.app', 'Contents');
  await mkdir(join(contents, 'MacOS'), { recursive: true });
  await writeFile(join(contents, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>HandoffGlassQATarget</string>
<key>CFBundleIdentifier</key><string>dev.handoffglass.qa.target</string>
<key>CFBundleName</key><string>HandoffGlassQATarget</string>
<key>CFBundlePackageType</key><string>APPL</string>
</dict></plist>`);
  const binary = join(contents, 'MacOS', 'HandoffGlassQATarget');
  await promisify(execFile)('swiftc', ['-O', join(root, 'test/fixtures/native-macos.swift'), '-o', binary]);
  const displays = await broker.displays();
  assert.equal(displays.connected, true);
  assert.equal(displays.headless, false);
  console.log('Keep the native QA window in front until it closes automatically (20 seconds).');
  child = spawn(binary, [], { stdio: ['ignore', 'pipe', 'inherit'] });
  const deadline = setTimeout(() => child.kill(), 25000);
  try {
    for await (const line of createInterface({ input: child.stdout })) {
      const { phase, bounds: b } = JSON.parse(line);
      const started = performance.now();
      if (phase === 'initial') {
        const shown = await broker.present('guide', { title: 'HandoffGlass native QA',
          message: 'Measured native fixture; no click required', target, template: 'sketch', timeoutSeconds: 30 });
        assert.equal(shown.visible, true);
        sessionId = shown.session.id;
      }
      let observed, centerError, sizeError;
      while (performance.now() - started < 3000) {
        const { session } = await broker.status(sessionId);
        const a = session.annotations[0];
        if(a){assert.equal(a.shape,'scribble');assert.equal(a.effect,'draw');assert.equal(a.durationMs,1100);}
        centerError = a ? Math.max(Math.abs(a.x - (b.x + b.width / 2)), Math.abs(a.y - (b.y + b.height / 2))) : null;
        sizeError = a ? Math.max(Math.abs(a.width - b.width), Math.abs(a.height - b.height)) : null;
        if (phase === 'hidden' ? session.targetTracking?.status === 'lost' && !a :
          session.targetTracking?.status === 'tracking' && a && centerError <= 1 && sizeError <= 2) {
          observed = session; break;
        }
        await pause(40);
      }
      assert.ok(observed, `${phase}: no reliable target state within 3s. Keep the fixture foreground and unobstructed.`);
      completed.push(phase);
      console.log(JSON.stringify({ phase, latencyMs: Math.round(performance.now() - started),
        centerErrorDIP: centerError, sizeErrorDIP: sizeError,
        status: observed.targetTracking.status, annotations: observed.annotations.length }));
    }
    assert.deepEqual(completed, ['initial', 'moved', 'hidden', 'restored', 'resized']);
    console.log('PASS native AX: measured geometry, live movement/resize, lost-target clearing and recovery');
  } finally { clearTimeout(deadline); }
} finally {
  if (sessionId) await broker.cancel(sessionId).catch(() => {});
  child?.kill();
  const info = await readManifest(dir);
  if (info) {
    try { process.kill(info.pid, 'SIGTERM'); } catch {}
    for (let i = 0; i < 60 && await probe(info); i++) await pause(50);
  }
  await rm(dir, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
}
