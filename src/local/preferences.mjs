/** Local user-owned visual preferences. No task history, credentials, window names or screenshots. */
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { lstat, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { runtimeDir, secureRuntimeDir } from '../runtime.mjs';

export const VISUAL_STYLES = Object.freeze(['minimal', 'luminous', 'handdrawn']);
export const MOTION_MODES = Object.freeze(['off', 'gentle', 'expressive']);
export const LOCALES = Object.freeze(['zh-CN', 'en-US']);
export const THEMES = Object.freeze(['system', 'dark', 'light']);
export const DEFAULT_PREFERENCES = Object.freeze({ version: 1, visualStyle: 'luminous', motion: 'gentle', locale: 'zh-CN', density: 'normal', theme: 'system' });
const KEYS = Object.freeze({ visualStyle: VISUAL_STYLES, motion: MOTION_MODES, locale: LOCALES, density: ['normal', 'compact'], theme: THEMES });
export function validatePreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Preferences must be an object');
  if (Object.keys(value).some(k => k !== 'version' && !Object.hasOwn(KEYS, k))) throw new TypeError('Unknown preference key');
  const result = { ...DEFAULT_PREFERENCES };
  for (const [key, allowed] of Object.entries(KEYS)) {
    if (value[key] !== undefined) {
      if (!allowed.includes(value[key])) throw new TypeError(`Invalid ${key}`);
      result[key] = value[key];
    }
  }
  if (value.version !== undefined && value.version !== 1) throw new TypeError('Unsupported preference version');
  return result;
}
/** Distinguish defaults from deliberate human preferences. Agents never override a saved choice. */
export async function hasUserPreferences(dir = runtimeDir()) {
  try {
    const entry = await lstat(join(dir, 'preferences.json'));
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('Invalid preferences file');
    return true;
  } catch(error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
export async function loadPreferences(dir = runtimeDir()) {
  const file = join(dir, 'preferences.json');
  try {
    const s = await lstat(file);
    if (!s.isFile() || s.isSymbolicLink()) throw new Error('Invalid preferences file');
    if (process.platform !== 'win32' && (s.mode & 0o077) !== 0) throw new Error('Preferences must be private (chmod 600)');
    const text = await readFile(file, 'utf8');
    if (text.length > 8192) throw new Error('Preferences too large');
    return validatePreferences(JSON.parse(text));
  } catch (error) {
    if (error.code === 'ENOENT') return { ...DEFAULT_PREFERENCES };
    throw error;
  }
}
export async function savePreferences(delta, dir = runtimeDir()) {
  await secureRuntimeDir(dir);
  const next = validatePreferences({ ...await loadPreferences(dir), ...delta });
  const temporary = join(dir, `.preferences-${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(next, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  try { await rename(temporary, join(dir, 'preferences.json')); }
  finally { await rm(temporary, { force: true }); }
  return next;
}
export async function resetPreferences(dir = runtimeDir()) {
  await secureRuntimeDir(dir);
  await rm(join(dir, 'preferences.json'), { force: true });
  return { ...DEFAULT_PREFERENCES };
}
