#!/usr/bin/env node
import {resolve} from 'node:path';
import {buildHarnessPlugin,removeHarnessPlugin} from '../src/harness-plugin.mjs';
const [action,host,...flags]=process.argv.slice(2);
const output=flags.find(f=>f.startsWith('--output='))?.slice(9)??resolve('dist',host+'-local');
if(!['build','remove'].includes(action))throw Error('Use build|remove claude-code|deepseek|opencode [--output=/path] [--apply]');
console.log(JSON.stringify(await(action==='build'?buildHarnessPlugin({host,output,desktopRuntime:!flags.includes('--no-desktop')}):removeHarnessPlugin({host,output,confirm:flags.includes('--apply')})),null,2));
