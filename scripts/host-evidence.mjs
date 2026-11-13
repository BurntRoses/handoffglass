#!/usr/bin/env node
/** Validate the host evidence matrix and any referenced acceptance records. */
import {readFile,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateHostEvidenceMatrix,validateHostEvidenceRecord} from '../src/host-evidence.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const path=resolve(root,process.argv[2]||'docs/host-evidence.json');
const matrix=JSON.parse(await readFile(path,'utf8'));
const errors=validateHostEvidenceMatrix(matrix);
for(const [host,item] of Object.entries(matrix.hosts||{})){
  if(!item.record)continue;
  const recordPath=resolve(root,item.record);
  if(!recordPath.startsWith(root+'/')&&!recordPath.startsWith(root+'\\')){errors.push(`hosts.${host}.record: path must stay inside the repository`);continue;}
  try{await access(recordPath);}catch{errors.push(`hosts.${host}.record: file does not exist`);continue;}
  const record=JSON.parse(await readFile(recordPath,'utf8'));
  errors.push(...validateHostEvidenceRecord(record,{host,status:item.status}));
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log(`Host evidence OK: ${Object.keys(matrix.hosts||{}).length} hosts; unverified records are not promoted automatically.`);
