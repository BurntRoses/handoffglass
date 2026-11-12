#!/usr/bin/env node
/** Prepare a self-contained native plugin inside an existing DSH checkout. */
import {resolve,join,isAbsolute} from 'node:path';
import {stat} from 'node:fs/promises';
import {buildHarnessPlugin} from '../src/harness-plugin.mjs';
const harnessRoot=process.argv[2];
if(!harnessRoot||!isAbsolute(harnessRoot))throw Error('Usage: node scripts/prepare-deepseek.mjs /absolute/path/to/deepseek-harness');
const root=resolve(harnessRoot);
if(!await stat(join(root,'pnpm-workspace.yaml')).then(s=>s.isFile()).catch(()=>false))throw Error('Expected an existing DeepSeek Harness checkout');
const output=join(root,'scratch-handoffglass');
const result=await buildHarnessPlugin({host:'deepseek',output,desktopRuntime:!process.argv.includes('--no-desktop')});
console.log(JSON.stringify({...result,patch:join(output,'cordis.yml'),command:'pnpm dsh web --patch ./scratch-handoffglass/cordis.yml'},null,2));
