/** Installation-scoped evidence. A host label is never authenticated application identity. */
import { join } from 'node:path';
import { codexInstallationEvidence } from './codex-install.mjs';
import { appWorkbuddyDirectory } from './integration-lifecycle.mjs';
import { readWorkbuddyRecord } from './workbuddy-bundle.mjs';
import { readManagedFile, digest } from './managed-files.mjs';

export async function connectionState(host,{dir,userHome,codexHome,root,live={},now=Date.now()}={}) {
  if(!['codex','workbuddy'].includes(host))throw new TypeError('Unsupported connection');
  let installed=false,managed=false,enabled=null,configurationMatches=false,ids=[];
  if(host==='codex') {
    const evidence=await codexInstallationEvidence({userHome,codexHome});
    ({installed,managed,enabled,configurationMatches}=evidence);
    if(evidence.installationId)ids.push(evidence.installationId);
  } else {
    const bundles=[appWorkbuddyDirectory(dir),...(root?[join(root,'dist','workbuddy-local')]:[])];
    for(const bundle of bundles){const saved=await readWorkbuddyRecord(bundle);if(saved.record){installed=true;managed=true;
      const config=await readManagedFile(join(bundle,'mcp.json'));
      if(config!==null && digest(config)===saved.record.files['mcp.json']){configurationMatches=true;if(saved.record.installationId)ids.push(saved.record.installationId);}
    }}
  }
  const evidence=Array.isArray(live.connectionEvidence)?live.connectionEvidence:[];
  const proof=evidence.filter(item=>ids.includes(item.connectionId||item.id) && item.host===host &&
    Number.isFinite(item.lastSuccessAt) && item.lastSuccessAt<=now && now-item.lastSuccessAt<900000)
    .sort((a,b)=>b.lastSuccessAt-a.lastSuccessAt)[0];
  const hostVerified=!!proof && configurationMatches && enabled!==false;
  const steps=[
    {id:'detect',state:'complete'},
    {id:'write',state:installed?'complete':'pending'},
    {id:'trust',state:hostVerified?'complete':enabled===false?'blocked':'unknown'},
    {id:'reload',state:hostVerified?'complete':installed?'pending':'unknown'},
    {id:'tools',state:hostVerified?'complete':'unknown'},
    {id:'call',state:hostVerified?'complete':'pending'}
  ];
  return {host,installed,managed,enabled,configurationMatches,steps,hostVerified,
    attribution:hostVerified?'installation_token':'none',hostIdentity:'caller_declared',version:null,
    verifiedAt:proof?.lastSuccessAt??null,lastTool:proof?.lastTool??null,
    nextAction:hostVerified?'ready':!installed?'install':enabled===false?'enable_in_host':
      host==='workbuddy'?'import_trust_enable_reload_and_call':!configurationMatches?'review_configuration':'reload_and_call',
    verificationPrompt:host==='codex'?'请调用 HandoffGlass 的 connection_status，检查此次连接。':'请启用 HandoffGlass 连接器，然后调用 connection_status 检查连接。'};
}
