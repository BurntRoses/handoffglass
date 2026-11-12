#!/usr/bin/env node
/** Official native plugin lifecycle; no direct cache/config/trust edits. */
import {buildCodexPlugin,CODEX_MARKETPLACE} from '../src/codex-plugin.mjs';
import {installCodexPlugin,removeCodexPlugin,nativeCodexPlugin} from '../src/codex-plugin-lifecycle.mjs';
const args=process.argv.slice(2),action=args[0]||'build';
if(!['build','install','remove','status'].includes(action)||args.slice(1).some(a=>!['--output=','--lifecycle=','--tool-profile='].some(prefix=>a.startsWith(prefix))))throw Error('Usage: node scripts/codex-plugin.mjs build|install|remove|status [--output=PATH] [--lifecycle=light|enhanced] [--tool-profile=host|full]');
const options={output:args.find(a=>a.startsWith('--output='))?.slice(9),lifecycle:args.find(a=>a.startsWith('--lifecycle='))?.slice(12),toolProfile:args.find(a=>a.startsWith('--tool-profile='))?.slice(15)};
try{
  const result=action==='build'?await buildCodexPlugin(options)
    :action==='status'?await nativeCodexPlugin(['list','--marketplace',CODEX_MARKETPLACE])
    :action==='install'?await installCodexPlugin(options)
    :await removeCodexPlugin({confirm:true});
  console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error.message);process.exitCode=1;}
