/** Fixed-path file operations with compare-before-write and rollback. */
import { dirname, join, parse, sep, isAbsolute } from 'node:path';
import { lstat, readFile, mkdir, writeFile, rename, rm, rmdir } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
export const digest = text => createHash('sha256').update(text).digest('hex');
export async function assertPrivatePath(path) {
  if(!isAbsolute(path))throw new Error('Managed paths must be absolute');
  for (let p = path; p !== parse(p).root; p = dirname(p)) {
    try { if ((await lstat(p)).isSymbolicLink() && !(process.platform==='darwin' && ['/var','/tmp','/etc'].includes(p))) throw new Error('Refusing a symlink path'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
export async function readManagedFile(path) {
  await assertPrivatePath(path);
  try {
    if (!(await lstat(path)).isFile()) throw new Error('Refusing a non-file');
    return await readFile(path, 'utf8');
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
export async function compareWrite({path, prior, next}) {
  if (await readManagedFile(path) !== prior) throw new Error('File changed; refresh the preview and retry');
  if (next === null) { await rm(path, {force:true}); return; }
  await mkdir(dirname(path), {recursive:true, mode:0o700});
  const temp = join(dirname(path), `.handoffglass-${randomUUID()}.tmp`);
  try {
    await writeFile(temp, next, {flag:'wx', mode:0o600});
    // Recheck after I/O before the atomic rename.
    if (await readManagedFile(path) !== prior) throw new Error('File changed; refresh the preview and retry');
    await rename(temp, path);
  } finally { await rm(temp, {force:true}); }
}
export async function applyFileTransaction(changes) {
  for (const file of changes) if (await readManagedFile(file.path) !== file.prior) throw new Error('File changed; retry');
  const done = [];
  try { for (const file of changes) { await compareWrite(file); done.push(file); } }
  catch (error) {
    for (const file of done.reverse()) {
      try { await compareWrite({path:file.path, prior:file.next, next:file.prior}); }
      catch { /* Preserve a concurrent user edit rather than overwrite it. */ }
    }
    throw error;
  }
}
export async function removeEmptyParents(file, boundary) {
  for (let dir = dirname(file); dir !== boundary && dir.startsWith(boundary + sep); dir = dirname(dir)) {
    try { await rmdir(dir); } catch { break; }
  }
}
