#!/usr/bin/env node
/** Validate the host evidence matrix and any referenced acceptance records. */
import {readFile,realpath} from 'node:fs/promises';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateHostEvidenceMatrix,validateHostEvidenceRecord} from '../src/host-evidence.mjs';
const root=await realpath(fileURLToPath(new URL('../',import.meta.url)));
const contained=path=>{const local=relative(root,path);return local!==''&&local!=='..'&&!local.startsWith('..'+sep)&&!isAbsolute(local);};
const path=resolve(root,process.argv[2]||'docs/host-evidence.json');
const matrix=JSON.parse(await readFile(path,'utf8'));
const errors=validateHostEvidenceMatrix(matrix);
for(const [host,item] of Object.entries(matrix.hosts||{})){
  if(!item?.record)continue;
  if(typeof item.record!=='string'){errors.push(`hosts.${host}.record: expected a repository path`);continue;}
  const recordPath=resolve(root,item.record);
  if(!contained(recordPath)){errors.push(`hosts.${host}.record: path must stay inside the repository`);continue;}
  try{
    if(!contained(await realpath(recordPath))){errors.push(`hosts.${host}.record: path must stay inside the repository`);continue;}
    const record=JSON.parse(await readFile(recordPath,'utf8'));
    errors.push(...validateHostEvidenceRecord(record,{host}));
  }catch(error){errors.push(`hosts.${host}.record: ${error.code==='ENOENT'?'file does not exist':error instanceof SyntaxError?'invalid JSON':'could not read record'}`);}
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log(`Host evidence OK: ${Object.keys(matrix.hosts||{}).length} hosts; unverified records are not promoted automatically.`);
