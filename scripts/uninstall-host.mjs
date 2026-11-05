#!/usr/bin/env node
/** Shared cleanup service; preview by default. `all` includes the recorded app. */
import { fileURLToPath } from 'node:url';
import { BrokerClient } from '../src/runtime.mjs';
import { cleanupIntegration, uninstallApplication, INTEGRATION_HOSTS } from '../src/integration-lifecycle.mjs';
const args=process.argv.slice(2),host=args[0],apply=args.includes('--apply');
if(![...INTEGRATION_HOSTS,'disable','enable','all'].includes(host)||args.slice(1).some(x=>x!=='--apply')){
  console.error('Usage: node scripts/uninstall-host.mjs codex|workbuddy|disable|enable|all [--apply]');process.exit(2);
}
try{
  const result=['enable','disable'].includes(host)
    ?apply?await new BrokerClient().setEnabled(host==='enable'):{applied:false,action:host,confirmationRequired:true}
    :host==='all'?await uninstallApplication({confirm:apply,root:fileURLToPath(new URL('../',import.meta.url))})
    :await cleanupIntegration(host,{confirm:apply,root:fileURLToPath(new URL('../',import.meta.url))});
  console.log(JSON.stringify(result,null,2));
}catch(error){console.error(`Cleanup refused: ${error.message}`);process.exitCode=1;}
