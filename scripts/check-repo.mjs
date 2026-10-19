#!/usr/bin/env node
/** Offline repository contract: markdown links, source entrypoints, aligned versions. */
import {readdir,readFile,stat} from 'node:fs/promises';
import {dirname,resolve,join,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const fail=[];
async function exists(path){try{return(await stat(path)).isFile();}catch{return false;}}
async function markdownIn(dir,found=[]){
  for(const e of await readdir(dir,{withFileTypes:true})){
    const path=join(dir,e.name);
    if(e.isDirectory())await markdownIn(path,found);
    else if(e.isFile()&&e.name.endsWith('.md'))found.push(path);
  }
  return found;
}
const markdown=[...await markdownIn(join(root,'docs'))];
for(const file of ['README.md','README.zh-CN.md','README.ja.md','AGENTS.md'])markdown.push(join(root,file));
for(const path of markdown){
  const source=await readFile(path,'utf8');
  // No network access: check the file part of local Markdown links only.
  for(const m of source.matchAll(/\]\(([^\n)]+)\)/g)){
    const raw=m[1].trim().replace(/^<([^>]+)>.*$/,'$1').split(/\s+"/)[0];
    if(!raw||/^(https?:|mailto:|data:|#|app:)/i.test(raw))continue;
    let decoded;
    try{decoded=decodeURIComponent(raw.split('#')[0].split('?')[0]);}catch{fail.push(`${relative(root,path)}: invalid link: ${raw}`);continue;}
    if(!decoded)continue;
    const linked=resolve(dirname(path),decoded);
    if(isAbsolute(decoded)||!linked.startsWith(root+'/')&&!linked.startsWith(root+'\\')){
      fail.push(`${relative(root,path)}: link outside repository: ${raw}`);continue;
    }
    try{await stat(linked);}catch{fail.push(`${relative(root,path)}: missing link: ${raw}`);}
  }
}
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const lock=JSON.parse(await readFile(join(root,'package-lock.json'),'utf8'));
const workbuddy=JSON.parse(await readFile(join(root,'integrations/workbuddy/connector-meta.json'),'utf8'));
const mcp=await readFile(join(root,'src/mcp.mjs'),'utf8');
for(const [name,actual] of Object.entries({lockfile:lock.version,lockRoot:lock.packages[''].version,workbuddy:workbuddy.version})){
  if(actual!==pkg.version)fail.push(`package version ${pkg.version} disagrees with ${name}: ${actual}`);
}
if(!mcp.includes(`version: '${pkg.version}'`))fail.push('MCP SDK server version is not aligned with package.json');
if(pkg.engines?.node!=='>=22')fail.push('Node engine contract differs from documented Node 22+ baseline');
for(const entry of ['src/mcp.mjs','src/desktop/app.mjs','scripts/build-overlay.mjs','docs/CODEX_HANDOFF.md','docs/ARCHITECTURE.md','docs/DESKTOP_QA.md']){
  if(!await exists(join(root,entry)))fail.push(`missing mandatory entrypoint: ${entry}`);
}
for(const [name,command] of Object.entries(pkg.scripts||{})){
  for(const match of command.matchAll(/(?:^|\s)node\s+(scripts\/[-a-zA-Z0-9./]+\.(?:mjs|js|cjs))/g)){
    if(!await exists(join(root,match[1])))fail.push(`npm ${name}: missing script ${match[1]}`);
  }
}
if(fail.length){console.error(fail.join('\n'));process.exitCode=1;}
else console.log(`Repository OK: ${markdown.length} Markdown files, entrypoints, local links and ${pkg.version} versions aligned`);
