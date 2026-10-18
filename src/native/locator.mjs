/** Strict, read-only foreground UI locator. No screenshot, click or text-value access. */
import { spawn } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { resolveGroundedTarget, GroundingError } from '../visual/grounding.mjs';
import { getAccessibilityConsent } from './preferences.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fail = (code, message) => { throw new GroundingError(code, message); };
export function requireConsent(env = process.env) {
  if (env.HANDOFFGLASS_ENABLE_ACCESSIBILITY !== '1')
    fail('consent_required', 'Native UI inspection is disabled. Set HANDOFFGLASS_ENABLE_ACCESSIBILITY=1 explicitly.');
}
export function validateTarget(target) {
  if (!target || typeof target !== 'object' || Array.isArray(target)) fail('invalid_query', 'Target object required');
  const value = {};
  for (const [key, cap] of [['app', 128], ['role', 80], ['name', 256]]) {
    if (typeof target[key] !== 'string' || !target[key].trim() || target[key].length > cap)
      fail('invalid_query', `Invalid exact target ${key}`);
    value[key] = target[key].trim();
  }
  return value;
}
/** Windows UIA provides physical pixels; Electron reports the per-monitor rectangle in DIP. */
export function physicalRectToDIP(rect, displays) {
  if (!rect || ![rect.x,rect.y,rect.width,rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0)
    fail('invalid_bounds', 'Physical bounds must be finite and nonempty');
  const px = rect.x + rect.width / 2, py = rect.y + rect.height / 2;
  const matches = displays.filter(d => {
    const p = d.physicalBounds;
    return p && [p.x,p.y,p.width,p.height].every(Number.isFinite) && p.width > 0 && p.height > 0 &&
      px >= p.x && px < p.x + p.width && py >= p.y && py < p.y + p.height;
  });
  if (matches.length !== 1) fail('display_mapping', 'No unambiguous physical-to-DIP display mapping');
  const d = matches[0], p = d.physicalBounds;
  const scaleX = d.width / p.width, scaleY = d.height / p.height;
  if (!(scaleX > 0 && scaleY > 0) || scaleX > 4 || scaleY > 4) fail('display_mapping', 'Invalid display scale');
  return { x: d.x + (rect.x - p.x) * scaleX, y: d.y + (rect.y - p.y) * scaleY,
    width: rect.width * scaleX, height: rect.height * scaleY };
}
export function normalizeNativeOutput(raw, target, displays, platform = process.platform) {
  const query = validateTarget(target);
  if (!raw || typeof raw !== 'object') fail('native_error', 'Native locator did not return an object');
  if (raw.error) fail(String(raw.code || 'native_error').slice(0, 64), String(raw.error).slice(0, 300));
  if (!Array.isArray(raw.candidates) || raw.candidates.length > 64) fail('native_error', 'Invalid candidate set');
  const candidates = raw.candidates.map(c => ({ ...c,
    bounds: platform === 'win32' ? physicalRectToDIP(c.bounds, displays) : c.bounds,
    coordinateSpace: 'global_DIP', source: platform === 'win32' ? 'uia' : 'accessibility'
  }));
  const located = resolveGroundedTarget(query, candidates, { displays, maxAgeMs: 2500 });
  return { ...located, app: query.app, role: query.role, name: query.name, matches: 1 };
}
export function nativeCommand(platform = process.platform, env = process.env) {
  const resource = env.HANDOFFGLASS_NATIVE_RESOURCE_DIR;
  if (platform === 'darwin') {
    const executable = resource ? join(resource, 'hg-locate') : join(ROOT, 'native/macos/hg-locate');
    if (existsSync(executable)) return { command: executable, args: [] };
    if (resource) fail('helper_missing', 'The packaged macOS accessibility helper is missing');
    return { command: 'swift', args: [join(ROOT, 'native/macos/locate.swift')] };
  }
  if (platform === 'win32') {
    const script = resource ? join(resource, 'locate.ps1') : join(ROOT, 'native/windows/locate.ps1');
    if (!existsSync(script)) fail('helper_missing', 'Windows UIA helper is missing');
    return { command: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script] };
  }
  fail('unsupported_platform', 'Native UI inspection currently supports macOS and Windows only');
}
export async function launchNative(cmd, target, { timeoutMs = 4500, spawnFn = spawn } = {}) {
  return new Promise((resolvePromise, reject) => {
    let finished = false, stdout = '', stderr = '';
    const finish = (error, result) => {
      if (finished) return; finished = true; clearTimeout(timer);
      if (error) reject(error); else resolvePromise(result);
    };
    const child = spawnFn(cmd.command, cmd.args, { windowsHide: true, stdio: ['pipe','pipe','pipe'] });
    const timer = setTimeout(() => { child.kill(); finish(new GroundingError('native_timeout', 'Accessibility query timed out')); }, timeoutMs);
    child.on('error', error => finish(new GroundingError('helper_unavailable', `Accessibility helper could not start: ${error.code || error.message}`)));
    child.stdout.on('data', chunk => { stdout += String(chunk); if (stdout.length > 32768) { child.kill(); finish(new GroundingError('native_output_limit', 'Accessibility helper returned too much data')); } });
    child.stderr.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-1000); });
    child.on('close', code => {
      if (finished) return;
      try {
        const response = JSON.parse(stdout);
        finish(null, response);
      } catch { finish(new GroundingError('native_error', `Accessibility helper failed (exit ${code}); ${stderr.slice(0,160)}`)); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(target) + '\n');
  });
}
export async function locateNative(target, displays, { env = process.env, platform = process.platform, command, runner = launchNative } = {}) {
  if (!(await getAccessibilityConsent({env}))) requireConsent(env);
  if (!Array.isArray(displays) || !displays.length) fail('no_desktop', 'Desktop display geometry unavailable');
  const query = validateTarget(target);
  const raw = await runner(command || nativeCommand(platform, env), query);
  return normalizeNativeOutput(raw, query, displays, platform);
}
