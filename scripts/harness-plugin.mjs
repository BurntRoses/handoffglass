#!/usr/bin/env node
import {resolve} from 'node:path';
import {buildHarnessPlugin,removeHarnessPlugin} from '../src/harness-plugin.mjs';
import {installHarness,harnessStatus,setHarnessEnabled,cleanupHarness,HARNESS_HOSTS} from '../src/harness-installation.mjs';
const [action,host,...flags]=process.argv.slice(2);
const option=name=>flags.find(f=>f.startsWith('--'+name+'='))?.slice(name.length+3);
if(!['build','remove','install','status','enable','disable','cleanup'].includes(action)||!HARNESS_HOSTS.includes(host)||flags.some(f=>!['--apply','--no-desktop'].includes(f)&&!/^--(?:output|config|workspace|home|runtime-dir|command|claude-command|lifecycle)=.+$/.test(f)))throw Error('Use build|remove|install|status|enable|disable|cleanup claude-code|deepseek|opencode|cursor|trae [--output=/path] [--config=/path] [--workspace=/path] [--lifecycle=light|enhanced] [--no-desktop] [--apply]');
const options={host,confirm:flags.includes('--apply'),desktopRuntime:!flags.includes('--no-desktop')};
for(const [flag,key]of [['output','output'],['config','configPath'],['workspace','workspace'],['home','home'],['runtime-dir','dir'],['command','command'],['claude-command','claudeCommand'],['lifecycle','lifecycle']])if(option(flag))options[key]=option(flag);
let result;
if(action==='build'||action==='remove'){
 options.output??=resolve('dist',host+'-local');
 result=action==='build'?await buildHarnessPlugin(options):await removeHarnessPlugin(options);
}else if(action==='install')result=await installHarness(host,options);
else if(action==='status')result=await harnessStatus(host,options);
else if(action==='cleanup')result=await cleanupHarness(host,options);
else result=options.confirm?await setHarnessEnabled(host,action==='enable',options):{host,action,applied:false,confirmationRequired:true};
console.log(JSON.stringify(result,null,2));
