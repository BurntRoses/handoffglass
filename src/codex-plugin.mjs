/** Machine-local Codex plugin builder. The production runtime stays in its checkout. */
import {readFile} from 'node:fs/promises';
import {resolve, join, relative, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readManagedFile, applyFileTransaction, digest} from './managed-files.mjs';
const projectRoot=fileURLToPath(new URL('../',import.meta.url));
export const CODEX_PLUGIN='handoffglass@handoffglass-local';
export const CODEX_MARKETPLACE='handoffglass-local';
const json=value=>JSON.stringify(value,null,2)+'\n';
const shell=value=>"'"+value.replaceAll("'","'\\''")+"'";

export async function buildCodexPlugin({output=join(projectRoot,'dist','codex-local'),command=process.execPath,root=projectRoot,envOverrides={},lifecycle,toolProfile}={}) {
  output=resolve(output);root=resolve(root);
  const plugin=join(output,'plugins','handoffglass'),files=new Map();
  const receiptPath=join(output,'handoffglass-build.json'),receiptRaw=await readManagedFile(receiptPath),receipt=receiptRaw?JSON.parse(receiptRaw):null;
  // Preserve an existing lifecycle choice. New installations need only Skills + MCP.
  lifecycle??=receipt?.lifecycle||(receipt?.files?.['plugins/handoffglass/hooks/hooks.json']?'enhanced':'light');
  if(!['light','enhanced'].includes(lifecycle))throw new TypeError('lifecycle must be light or enhanced');
  toolProfile??=receipt?.toolProfile||'host';
  if(!['host','full'].includes(toolProfile))throw new TypeError('toolProfile must be host or full');
  const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
  const manifest=JSON.parse(await readFile(join(root,'integrations','codex-plugin','plugin.json'),'utf8'));
  manifest.version=pkg.version;
  // Codex 0.167 reads this compatibility format completely. With a root
  // portable manifest it discovers skills/MCP but omits bundled hooks.
  const compat={...manifest,...manifest.extensions['com.openai'],skills:'./skills/',mcpServers:'./.mcp.json'};
  delete compat.$schema;delete compat.extensions;
  if(lifecycle==='light')delete compat.hooks;
  compat.description='Host-observed regions, local screen drawing and user-guided steps.';
  compat.interface.longDescription='宿主读取界面，HandoffGlass 绘制标记和步骤卡片。用户操作，Agent 核实后继续。';
  files.set('.codex-plugin/plugin.json',json(compat));
  const server={command,args:[join(root,'src','mcp.mjs')],env:{HANDOFFGLASS_HOST_ID:'codex',HANDOFFGLASS_OUTPUT:'compact',HANDOFFGLASS_TOOL_PROFILE:toolProfile,...envOverrides}};
  files.set('.mcp.json',json({mcpServers:{handoffglass:server}}));
  files.set('local-runtime.json',json({schemaVersion:1,root,command,entry:join(root,'src','mcp.mjs'),machineLocal:true}));
  if(lifecycle==='enhanced')files.set('hooks/run.mjs',`import {pathToFileURL} from 'node:url';\nconst {runCodexHook}=await import(pathToFileURL(${JSON.stringify(join(root,'src','hosts','codex-hooks.mjs'))}).href);\nawait runCodexHook();\n`);
  const hooks={};
  for(const event of ['PreToolUse','PostToolUse','Stop','Interrupt','SessionEnd']) {
    const settings={type:'command',command:`${shell(command)} "\${PLUGIN_ROOT}/hooks/run.mjs"`,
      commandWindows:`"${command}" "%PLUGIN_ROOT%\\hooks\\run.mjs"`,timeout:['Interrupt','SessionEnd'].includes(event)?2:3};
    const matcher=['PreToolUse','PostToolUse'].includes(event)?{matcher:'mcp__.*handoffglass.*__session_(start|present|resume|wait|verify|stop|control|update)$'}:{};
    hooks[event]=[{...matcher,hooks:[settings]}];
  }
  if(lifecycle==='enhanced')files.set('hooks/hooks.json',json({description:'Optional guidance lifecycle. Drawing has no hooks; no per-model-request hook.',hooks}));
  for(const name of ['SKILL.md','references/tool-contracts.md'])files.set('skills/visual-handoff/'+name,await readFile(join(root,'skills','visual-handoff',name),'utf8'));
  files.set('skills/handoffglass-setup/SKILL.md',await readFile(join(root,'integrations','codex-plugin','skills','handoffglass-setup','SKILL.md'),'utf8'));
  files.set('assets/brandmark.svg',await readFile(join(root,'assets','brandmark.svg'),'utf8'));
  files.set('LICENSE',await readFile(join(root,'LICENSE'),'utf8'));
  const marketPath=join(output,'.agents','plugins','marketplace.json');
  const marketplace={name:CODEX_MARKETPLACE,interface:{displayName:'HandoffGlass · 本机试用'},plugins:[{
    name:'handoffglass',source:{source:'local',path:'./plugins/handoffglass'},policy:{installation:'AVAILABLE',authentication:'ON_INSTALL'},category:'Productivity'}]};
  const changes=[];
  for(const old of ['plugin.json','mcp.json',...(lifecycle==='light'?['hooks/run.mjs','hooks/hooks.json']:[])]){
    const path=join(plugin,old),prior=await readManagedFile(path);
    if(prior===null)continue;
    if(digest(prior)!==receipt?.files?.['plugins/handoffglass/'+old])throw Error('Generated plugin file has local edits: '+old);
    changes.push({path,prior,next:null});
  }
  for(const [name,next] of [...files].map(([p,v])=>[join(plugin,p),v]).concat([[marketPath,json(marketplace)]])) {
    const prior=await readManagedFile(name),key=relative(output,name).split(sep).join('/');
    if(prior!==null && prior!==next && (!receipt?.files?.[key] || digest(prior)!==receipt.files[key]))throw new Error('Generated plugin file has local edits: '+key);
    if(prior!==next)changes.push({path:name,prior,next});
  }
  const nextReceipt=json({schemaVersion:1,lifecycle,toolProfile:server.env.HANDOFFGLASS_TOOL_PROFILE,files:Object.fromEntries([...files].map(([p,v])=>['plugins/handoffglass/'+p,digest(v)]).concat([['.agents/plugins/marketplace.json',digest(json(marketplace))]]))});
  if(receiptRaw!==nextReceipt)changes.push({path:receiptPath,prior:receiptRaw,next:nextReceipt});
  await applyFileTransaction(changes);
  return {marketplaceRoot:output,marketplacePath:marketPath,pluginPath:plugin,plugin:CODEX_PLUGIN,version:pkg.version,lifecycle,toolProfile:server.env.HANDOFFGLASS_TOOL_PROFILE,machineLocal:true};
}
