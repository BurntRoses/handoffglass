#!/usr/bin/env node
/** Prepare an out-of-tree DeepSeek Harness Cordis patch INSIDE the user's checkout. */
import { resolve, join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
const harnessRoot = process.argv[2];
if (!harnessRoot || !isAbsolute(harnessRoot)) {
  console.error('Usage: node scripts/prepare-deepseek.mjs /absolute/path/to/deepseek-harness'); process.exit(2);
}
const root=resolve(harnessRoot);
const match=await stat(join(root,'pnpm-workspace.yaml')).then(x=>x.isFile()).catch(()=>false);
if(!match) throw new Error('Directory must be a real DeepSeek Harness source checkout containing pnpm-workspace.yaml');
const here=dirname(fileURLToPath(import.meta.url));
const runtime=pathToFileURL(resolve(here,'../src/runtime.mjs')).href;
const folder=join(root,'scratch-handoffglass','src');
await mkdir(folder,{recursive:true});
const source=(await readFile(resolve(here,'../integrations/deepseek-harness/src/plugin.ts'),'utf8'))
  .replace('__HANDOFFGLASS_RUNTIME__',runtime);
await writeFile(join(folder,'plugin.ts'),source);
await writeFile(join(root,'scratch-handoffglass','cordis.yml'), `- insert:\n    - id: handoffglass\n      name: ${JSON.stringify(join(folder,'plugin.ts'))}\n`);
console.log(JSON.stringify({plugin:join(folder,'plugin.ts'),patch:join(root,'scratch-handoffglass','cordis.yml'),command:'pnpm dsh web --patch ./scratch-handoffglass/cordis.yml'},null,2));
