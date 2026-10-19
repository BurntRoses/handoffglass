#!/usr/bin/env node
/** Launch a disposable real MCP + desktop trial. --smoke uses synthetic fixture actions. */
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const electron=(await import('electron')).default;
const env={...process.env,HANDOFFGLASS_TRIAL_NODE:process.execPath};
delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(electron,[fileURLToPath(new URL('./visual-trial-desktop.mjs',import.meta.url)),...process.argv.slice(2)],{env,stdio:'inherit'});
child.on('error',error=>{console.error(error);process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
const [code]=await once(child,'close');process.exitCode=code??1;
