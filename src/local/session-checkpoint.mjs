import { join } from 'node:path';
import { lstat, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { loadPreferences } from './preferences.mjs';

/** Minimal private recovery record: no task text, controls, coordinates or raw credentials. */
export async function attachSessionCheckpoint(manager, dir) {
  const file = join(dir, 'session-checkpoint.json');
  try {
    const s = await lstat(file);
    if (s.isFile() && !s.isSymbolicLink() && s.size <= 8192 &&
        (process.platform === 'win32' || (s.uid === process.getuid() && (s.mode & 0o077) === 0))) {
      const prefs = await loadPreferences(dir);
      if (prefs.enabled && prefs.continuous) manager.restoreCheckpoint(JSON.parse(await readFile(file, 'utf8')));
    }
  } catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
  let pending = Promise.resolve(), lastError=null;
  const save = () => {
    const record = manager.exportCheckpoint();
    pending = pending.then(async () => {
      lastError=null;
      if (!record?.resumeHash) { await rm(file, { force: true }); return; }
      const temporary = join(dir, `.checkpoint-${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, JSON.stringify(record), { mode: 0o600, flag: 'wx' });
        await rename(temporary, file);
      } finally { await rm(temporary, { force: true }); }
    }).catch(error => { lastError=error;console.error('[handoffglass] Recovery record:', error.code || 'write_failed'); });
  };
  // Coordinates and progress updates do not change the recovery record.
  let last = JSON.stringify(manager.exportCheckpoint());
  const changed = () => {
    const next = JSON.stringify(manager.exportCheckpoint());
    if (next !== last) { last = next; save(); }
  };
  manager.on('show', changed); manager.on('change', changed); manager.on('checkpoint', changed);
  const flush=async()=>{await pending;if(lastError)throw Object.assign(new Error('Recovery record could not be saved'),{code:'checkpoint_unavailable'});};
  manager.flushCheckpoint=flush;
  return { flush, close: async () => {
    manager.off('show', changed); manager.off('change', changed); manager.off('checkpoint', changed);
    delete manager.flushCheckpoint;
    await pending;
  } };
}
