#!/usr/bin/env node
/** Standalone second-stage remover, copied outside the app before it exits. */
import {readFile,writeFile,lstat,readlink,unlink,rmdir,rm} from 'node:fs/promises';
import {createReadStream, realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,parse} from 'node:path';
import {pathToFileURL} from 'node:url';
export async function removeOwnedFiles(plan) {
  const removed=[],retained=[];
  for(const entry of plan.entries) {
    try {
      for(let p=dirname(entry.path);p!==parse(p).root;p=dirname(p)) {
        const stat=await lstat(p);if(stat.isSymbolicLink() && !['/tmp','/var','/etc'].includes(p))throw Error('symlink_parent');
      }
      const stat=await lstat(entry.path);
      if(entry.kind==='directory') {if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('changed_by_user');await rmdir(entry.path);}
      else if(entry.kind==='link') {if(!stat.isSymbolicLink()||await readlink(entry.path)!==entry.value)throw Error('changed_by_user');await unlink(entry.path);}
      else {
        if(!stat.isFile()||stat.isSymbolicLink())throw Error('changed_by_user');
        const hash=createHash('sha256');for await(const chunk of createReadStream(entry.path))hash.update(chunk);
        if(hash.digest('hex')!==entry.digest)throw Error('changed_by_user');
        await unlink(entry.path);
      }
      removed.push(entry.path);
    }catch(error){if(error.code==='ENOENT')continue;retained.push({path:entry.path,reason:error.code==='ENOTEMPTY'?'contains_unrecorded_files':error.message});}
  }
  return {complete:retained.length===0,removed,retained};
}
async function main() {
  const file=process.argv[2],plan=JSON.parse(await readFile(file,'utf8'));
  await writeFile(plan.readyPath,'ready',{mode:0o600});
  const deadline=Date.now()+30000;
  function alive(pid){try{process.kill(pid,0);return true;}catch{return false;}}
  while(plan.waitPids.some(alive)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,200));
  const result=plan.waitPids.some(alive)?{complete:false,removed:[],retained:plan.entries.map(e=>({path:e.path,reason:'application_still_running'}))}:await removeOwnedFiles(plan);
  result.retained.push(...(plan.priorRetained||[]));
  result.hostActions=plan.hostActions||[];
  result.complete=result.complete && !result.retained.length && !result.hostActions.some(a=>a.host==='workbuddy');
  await writeFile(plan.resultPath,JSON.stringify({...result,completedAt:Date.now()},null,2)+'\n',{mode:0o600});
  await rm(file,{force:true});
}
if(process.argv[1] && import.meta.url===pathToFileURL(realpathSync(process.argv[1])).href)main().catch(error=>{console.error('Uninstall failed:',error.message);process.exitCode=1;});
