/** Build/remove owned local host bundles. Never edits host trust or unrelated settings. */
import {readFile,readdir,rmdir} from 'node:fs/promises';
import {join,resolve,sep,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pluginSnapshot} from './plugin-snapshot.mjs';
import {readManagedFile,readManagedBytes,readManagedLink,applyFileTransaction,digest,removeEmptyParents} from './managed-files.mjs';
const rootDefault=fileURLToPath(new URL('../',import.meta.url));
const hosts=['claude-code','deepseek','opencode'];
const json=v=>JSON.stringify(v,null,2)+'\n';
async function receiptAt(output){const path=join(output,'handoffglass-bundle.json'),raw=await readManagedFile(path);return {path,raw,receipt:raw?JSON.parse(raw):null};}
function check(receipt,host){
 if(receipt&&(receipt.schemaVersion!==1||receipt.host!==host||!receipt.files))throw Error('Unrecognized HandoffGlass bundle receipt');
 for(const [name,hash]of Object.entries(receipt?.files??{}))if(name.split(/[\\/]/).includes('..')||name.startsWith('/')||!/^[a-f0-9]{64}$/.test(hash))throw Error('Invalid bundle ownership');
}
export async function buildHarnessPlugin({host,output,root=rootDefault,command=process.execPath,desktopRuntime=true}={}){
 if(!hosts.includes(host)||!output)throw Error('Expected claude-code, deepseek or opencode and an output folder');
 output=resolve(output);const {path,raw,receipt}=await receiptAt(output);check(receipt,host);
 const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8')),snapshot=await pluginSnapshot(root,{desktop:desktopRuntime}),files=new Map(snapshot.files);
 files.set('skills/visual-handoff/SKILL.md',await readFile(join(root,'skills/visual-handoff/SKILL.md')));
 files.set('skills/visual-handoff/references/tool-contracts.md',await readFile(join(root,'skills/visual-handoff/references/tool-contracts.md')));
 files.set('LICENSE',await readFile(join(root,'LICENSE')));files.set('NOTICE',await readFile(join(root,'NOTICE')));
 const env={HANDOFFGLASS_HOST_ID:host,HANDOFFGLASS_OUTPUT:'compact',HANDOFFGLASS_TOOL_PROFILE:'host',...(desktopRuntime?{HANDOFFGLASS_EMBEDDED_RENDERER:'1'}:{})};
 if(host==='claude-code'){
  const manifest=JSON.parse(await readFile(join(root,'integrations/claude-code/plugin.json'),'utf8'));manifest.version=pkg.version;
  files.set('.claude-plugin/plugin.json',json(manifest));files.set('.mcp.json',json({mcpServers:{handoffglass:{command,args:['${CLAUDE_PLUGIN_ROOT}/runtime/src/mcp.mjs'],env}}}));
 }else if(host==='opencode'){
  files.set('index.ts',await readFile(join(root,'integrations/opencode/index.ts')));
  files.set('package.json',json({name:'handoffglass-local',version:pkg.version,type:'module',exports:'./index.ts',peerDependencies:{'@opencode/plugin':'*'},license:pkg.license}));
 }else{
  files.set('src/plugin.ts',await readFile(join(root,'integrations/deepseek-harness/src/plugin.ts')));
  files.set('cordis.yml','- insert:\n    - id: handoffglass\n      name: ./'+basename(output)+'/src/plugin.ts\n');
 }
 files.set('runtime-evidence.json',json({version:pkg.version,host,checkoutRequired:false,desktopRuntime,nodeRequired:true,platform:process.platform,arch:process.arch,endToEnd:'unverified'}));
 const changes=[];
 for(const name of new Set([...Object.keys(receipt?.files??{}),...files.keys()])){
  const file=join(output,name),kind=snapshot.links[name]||receipt?.links?.[name]?'symlink':undefined;
  const prior=kind?await readManagedLink(file):await readManagedBytes(file),next=files.get(name)??null;
  if(prior!==null&&digest(prior)!==receipt?.files?.[name]&&(!next||digest(prior)!==digest(next)))throw Error('Bundle file has local edits: '+name);
  if((prior===null)!==(next===null)||prior!==null&&digest(prior)!==digest(next))changes.push({path:file,prior,next,mode:snapshot.modes[name],kind});
 }
 const next=json({schemaVersion:1,host,files:Object.fromEntries([...files].map(([name,data])=>[name,digest(data)])),links:snapshot.links});
 if(raw!==next)changes.push({path,prior:raw,next});await applyFileTransaction(changes);
 return {host,output,version:pkg.version,checkoutRequired:false,installed:false,endToEnd:'unverified'};
}
export async function removeHarnessPlugin({host,output,confirm=false}={}){
 if(!hosts.includes(host)||!output)throw Error('Expected host and output folder');
 output=resolve(output);const {path,raw,receipt}=await receiptAt(output);check(receipt,host);
 if(!receipt)return {applied:false,state:'not_installed',retained:[]};
 const changes=[],retained=[];
 for(const [name,hash]of Object.entries(receipt.files)){
  const file=resolve(output,name);if(!file.startsWith(output+sep))throw Error('Invalid bundle path');
  const kind=receipt.links?.[name]?'symlink':undefined,prior=kind?await readManagedLink(file):await readManagedBytes(file);
  if(prior===null)continue;
  if(digest(prior)!==hash){retained.push({path:file,reason:'changed_by_user'});continue;}
  changes.push({path:file,prior,next:null,kind});
 }
 async function scan(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const file=join(folder,entry.name);if(entry.isDirectory())await scan(file);else{const key=file.slice(output.length+1).split(sep).join('/');if(file!==path&&!Object.hasOwn(receipt.files,key))retained.push({path:file,reason:'not_owned'});}}}
 await scan(output);
 if(confirm){if(!retained.length)changes.push({path,prior:raw,next:null});await applyFileTransaction(changes);for(const file of changes)await removeEmptyParents(file.path,output);try{await rmdir(output);}catch{/* User files remain. */}}
 return {applied:confirm,removed:confirm?changes.map(c=>c.path):[],planned:changes.map(c=>c.path),retained,hostAction:'Remove the local plugin reference using the host UI/config and reload. Host configuration was not edited.'};
}
