/** Local per-user opt-in. NEVER enabled by default; no application content is persisted. */
import { readFile, writeFile, rename, rm, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runtimeDir, secureRuntimeDir } from '../runtime.mjs';
export async function getAccessibilityConsent({env=process.env, dir=runtimeDir(env)}={}) {
  if (env.HANDOFFGLASS_ENABLE_ACCESSIBILITY === '1') return true;
  try {
    const file=join(dir,'accessibility.json');
    const stat=await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || (process.platform!=='win32' &&
      (stat.uid!==process.getuid() || (stat.mode & 0o077)!==0))) return false;
    const value=JSON.parse(await readFile(file,'utf8'));
    return value?.consent===true && value?.version===1;
  } catch { return false; }
}
export async function setAccessibilityConsent(value,{env=process.env,dir=runtimeDir(env)}={}) {
  if (typeof value !== 'boolean') throw new TypeError('Boolean opt-in required');
  await secureRuntimeDir(dir);
  const tmp=join(dir,`.accessibility-${randomUUID()}.tmp`);
  await writeFile(tmp,JSON.stringify({version:1,consent:value})+'\n',{mode:0o600,flag:'wx'});
  try { await rename(tmp,join(dir,'accessibility.json')); }
  finally { await rm(tmp,{force:true}); }
  return value;
}
