#!/usr/bin/env node
/** Check every maintained JS file instead of a brittle handwritten list. */
import {readdir} from 'node:fs/promises';
import {dirname,extname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const directories=['src','scripts','site','demo','examples'];
const valid=new Set(['.js','.mjs','.cjs']);
async function walk(dir,output){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(entry.name==='node_modules'||entry.name==='dist')continue;
    const name=join(dir,entry.name);
    if(entry.isDirectory())await walk(name,output);
    else if(entry.isFile()&&valid.has(extname(entry.name)))output.push(name);
  }
}
const files=[];
for(const dir of directories)await walk(join(root,dir),files);
files.sort();
const errors=[];
for(const path of files){
  const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8',maxBuffer:256*1024});
  if(result.status!==0)errors.push({file:relative(root,path),error:(result.stderr||result.error?.message||'syntax check failed').trim()});
}
for(const issue of errors)console.error(`${issue.file}: ${issue.error}`);
console.log(`Checked ${files.length} JavaScript files`);
if(errors.length)process.exitCode=1;
