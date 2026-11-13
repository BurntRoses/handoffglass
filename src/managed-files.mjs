/** Fixed-path file operations with compare-before-write and rollback. */
import { dirname, join, parse, sep, isAbsolute } from 'node:path';
import * as filePromises from 'node:fs/promises';
import {createRequire} from 'node:module';
import { randomUUID, createHash } from 'node:crypto';
// Owned paths are real files, including copied .asar archives. Electron's
// patched fs would otherwise interpret a not-yet-written archive as a folder.
const {lstat,readFile,readlink,symlink,mkdir,writeFile,rename,rm,rmdir}=process.versions.electron
  ?createRequire(import.meta.url)('original-fs').promises:filePromises;
export const digest = text => createHash('sha256').update(text).digest('hex');
export async function assertPrivatePath(path) {
  if(!isAbsolute(path))throw new Error('Managed paths must be absolute');
  for (let p = path; p !== parse(p).root; p = dirname(p)) {
    try { if ((await lstat(p)).isSymbolicLink() && !(process.platform==='darwin' && ['/var','/tmp','/etc'].includes(p))) throw new Error('Refusing a symlink path'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
export async function readManagedFile(path) {
  const bytes=await readManagedBytes(path);
  return bytes===null?null:bytes.toString('utf8');
}
export async function readManagedBytes(path) {
  await assertPrivatePath(path);
  try {
    if (!(await lstat(path)).isFile()) throw new Error('Refusing a non-file');
    return await readFile(path);
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
const equal=(a,b)=>Buffer.isBuffer(a)&&Buffer.isBuffer(b)?a.equals(b):a===b;
export async function readManagedLink(path){
  await assertPrivatePath(dirname(path));
  try{if(!(await lstat(path)).isSymbolicLink())throw Error('Expected a recorded runtime link');return await readlink(path);}
  catch(error){if(error.code==='ENOENT')return null;throw error;}
}
const readPrior=file=>file.kind==='symlink'?readManagedLink(file.path):Buffer.isBuffer(file.prior)||Buffer.isBuffer(file.next)?readManagedBytes(file.path):readManagedFile(file.path);
export async function compareWrite({path, prior, next, mode=0o600,kind}) {
  const file={path,prior,next,kind};
  if (!equal(await readPrior(file),prior)) throw new Error('File changed; refresh the preview and retry');
  if (next === null) { await rm(path, {force:true}); return; }
  await mkdir(dirname(path), {recursive:true, mode:0o700});
  const temp = join(dirname(path), `.handoffglass-${randomUUID()}.tmp`);
  try {
    if(kind==='symlink')await symlink(next,temp);
    else await writeFile(temp, next, {flag:'wx', mode});
    // Recheck after I/O before the atomic rename.
    if (!equal(await readPrior(file),prior)) throw new Error('File changed; refresh the preview and retry');
    await rename(temp, path);
  } finally { await rm(temp, {force:true}); }
}
export async function applyFileTransaction(changes) {
  for (const file of changes) if (!equal(await readPrior(file),file.prior)) throw new Error('File changed; retry');
  const done = [];
  try { for (const file of changes) { await compareWrite(file); done.push(file); } }
  catch (error) {
    for (const file of done.reverse()) {
      try { await compareWrite({path:file.path, prior:file.next, next:file.prior,mode:file.mode,kind:file.kind}); }
      catch { /* Preserve a concurrent user edit rather than overwrite it. */ }
    }
    throw error;
  }
}
/** Full uninstall leaves loaded plugin files for the external, post-exit worker. */
export function deferManagedRemovals(changes,entries,roots) {
  if(!entries)return changes;
  const immediate=[],directories=new Set();
  for(const file of changes){
    const boundary=roots.find(root=>root&&(file.path===root||file.path.startsWith(root+sep)));
    if(file.next!==null||!boundary){immediate.push(file);continue;}
    entries.push(file.kind==='symlink'?{path:file.path,kind:'link',value:file.prior}:{path:file.path,kind:'file',digest:digest(file.prior)});
    for(let dir=dirname(file.path);dir===boundary||dir.startsWith(boundary+sep);dir=dirname(dir)){
      directories.add(dir);if(dir===boundary)break;
    }
  }
  for(const path of [...directories].sort((a,b)=>b.length-a.length))entries.push({path,kind:'directory'});
  return immediate;
}
export async function removeEmptyParents(file, boundary) {
  for (let dir = dirname(file); dir !== boundary && dir.startsWith(boundary + sep); dir = dirname(dir)) {
    try { await rmdir(dir); } catch { break; }
  }
}
