#!/usr/bin/env node
/** Check distributable archive/executable and produce SHA-256 checksums. Not GUI QA. */
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const dir=resolve(process.argv[2]||'dist');
const expected=process.platform==='darwin'?'.zip':process.platform==='win32'?'.exe':'.AppImage';
const entries=(await readdir(dir)).filter(x=>x.endsWith(expected));
if (!entries.length) throw new Error(`No distributable ${expected} in ${dir}`);
let checksums=[];
for(const name of entries){
  const path=join(dir,name), info=await stat(path);
  if(!info.isFile() || info.size<1024*1024) throw new Error(`Empty or implausible distributable: ${name}`);
  const sha=createHash('sha256').update(await readFile(path)).digest('hex');
  checksums.push(`${sha}  ${name}`);
  console.log(`${name}: ${(info.size/1048576).toFixed(1)} MiB SHA256 ${sha}`);
}
await writeFile(join(dir,'SHA256SUMS.txt'),checksums.join('\n')+'\n');
