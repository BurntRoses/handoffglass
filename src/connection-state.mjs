/** Installation-scoped evidence. A host label is never authenticated application identity. */
import { join } from 'node:path';
import { codexInstallationEvidence } from './codex-install.mjs';
import { codexPluginEvidence } from './codex-plugin-lifecycle.mjs';
import { appWorkbuddyDirectory } from './integration-lifecycle.mjs';
import { readWorkbuddyRecord } from './workbuddy-bundle.mjs';
import { readManagedFile, digest } from './managed-files.mjs';
import {HARNESS_HOSTS,harnessStatus} from './harness-installation.mjs';
import {checkCodexReadiness} from './local/codex-readiness.mjs';

export async function connectionState(host,{dir,userHome,codexHome,root,live={},now=Date.now(),...options}={}) {
  if(!['codex','workbuddy',...HARNESS_HOSTS].includes(host))throw new TypeError('Unsupported connection');
  let installed=false,managed=false,enabled=null,configurationMatches=false,ids=[],nativePlugin=false,hookMode='unknown';
  let local=null;
  if(host==='codex') {
    const plugin=await codexPluginEvidence({userHome,codexHome});
    nativePlugin=plugin.nativePlugin;
    hookMode=plugin.hookMode;
    const evidence=nativePlugin?plugin:await codexInstallationEvidence({userHome,codexHome});
    ({installed,managed,enabled,configurationMatches}=evidence);
    if(evidence.installationId)ids.push(evidence.installationId);
  } else if(host==='workbuddy') {
    const bundles=[appWorkbuddyDirectory(dir),...(root?[join(root,'dist','workbuddy-local')]:[])];
    for(const bundle of bundles){const saved=await readWorkbuddyRecord(bundle);if(saved.record){installed=true;managed=true;
      const config=await readManagedFile(join(bundle,'mcp.json'));
      if(config!==null && digest(config)===saved.record.files['mcp.json']){configurationMatches=true;if(saved.record.installationId)ids.push(saved.record.installationId);}
    }}
  }else{
    local=await harnessStatus(host,{dir,userHome,home:userHome,root,...options});
    ({installed,managed,enabled,configurationMatches}=local);
    nativePlugin=['claude-code','deepseek','opencode'].includes(host);
    hookMode=local.hookMode||'light';
    if(local.installationId)ids.push(local.installationId);
  }
  const evidence=Array.isArray(live.connectionEvidence)?live.connectionEvidence:[];
  const proof=evidence.filter(item=>ids.includes(item.connectionId||item.id) && item.host===host &&
    Number.isFinite(item.lastSuccessAt) && item.lastSuccessAt<=now && now-item.lastSuccessAt<900000)
    .sort((a,b)=>b.lastSuccessAt-a.lastSuccessAt)[0];
  const hostVerified=!!proof && configurationMatches && enabled!==false;
  const readiness=host==='codex'&&nativePlugin?await checkCodexReadiness({codexHome,userHome,hostEvidence:proof?{source:'current_host',loaded:true,lastCall:{tool:proof.lastTool==='displays'?'screen_displays':'connection_status',ok:true}}:undefined}):null;
  const steps=[
    {id:'detect',state:'complete'},
    {id:'write',state:installed?'complete':'pending'},
    {id:'trust',state:enabled===false?'blocked':hostVerified&&(!nativePlugin||hookMode==='light')?'complete':'unknown'},
    {id:'reload',state:hostVerified?'complete':installed?'pending':'unknown'},
    {id:'tools',state:hostVerified?'complete':'unknown'},
    ...(readiness?[{id:'approval',state:readiness.stages.tool_approval.status==='passed'?'complete':readiness.stages.tool_approval.status==='blocked'?'blocked':'unknown'}]:[]),
    {id:'call',state:hostVerified?'complete':'pending'}
  ];
  return {host,installed,managed,enabled,configurationMatches,steps,hostVerified,nativePlugin,...(nativePlugin?{hookMode,hookTrust:hookMode==='light'?'not_required':'not_observed'}:{}),
    ...(readiness?{readiness}:{}),
    attribution:hostVerified?'installation_token':'none',hostIdentity:'caller_declared',version:null,
    verifiedAt:proof?.lastSuccessAt??null,lastTool:proof?.lastTool??null,
    nextAction:hostVerified?(nativePlugin&&hookMode!=='light'?'review_hooks':'ready'):!installed?'install':enabled===false?'enable_in_host':
      host==='workbuddy'?'import_trust_enable_reload_and_call':!configurationMatches?'review_configuration':'reload_and_call',
    ...(local?{hostAction:local.hostAction,launchCommand:local.launchCommand,launchEnv:local.launchEnv}:{}),
    verificationPrompt:host==='workbuddy'?'请启用 HandoffGlass 连接器，然后调用 connection_status 检查连接。':'请调用 HandoffGlass 的 connection_status，检查此次连接。'};
}
