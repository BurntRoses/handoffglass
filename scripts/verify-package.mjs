#!/usr/bin/env node
/** Structural smoke check only. A passing archive build is NOT real native-GUI acceptance. */
import { readdir, stat, access, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root=resolve('dist');
const entries=await readdir(root,{withFileTypes:true});
const dirs=entries.filter(x=>x.isDirectory()).map(x=>join(root,x.name));
const packageRoots=process.platform==='darwin'
  ? (await Promise.all(dirs.map(async d=>({d,content:await readdir(d)})))).flatMap(x=>x.content.filter(c=>c.endsWith('.app')).map(c=>join(x.d,c,'Contents','Resources')))
  : dirs.map(d=>join(d,'resources'));
let found=[];
for (const target of packageRoots) {
  try {
    await access(join(target,'app.asar'));
    const binary=join(target,'native',process.platform==='darwin'?'hg-locate':'locate.ps1');
    await access(binary);
    found.push({application:target,binary});
  } catch { /* a different target directory */ }
}
if (!found.length) { console.error('Packaged Electron app or native locator missing');process.exit(1); }
console.log(JSON.stringify({mode:'structural-only',platform:process.platform,validated:found},null,2));
