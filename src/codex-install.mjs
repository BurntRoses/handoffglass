/** Receipted Codex installation; cleanup restores only content still owned by us. */
import { homedir } from 'node:os';
import { join, dirname, sep } from 'node:path';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { parse } from 'smol-toml';
import { isDeepStrictEqual } from 'node:util';
import { mergeHostToml } from './host-install.mjs';
import { readManagedFile, applyFileTransaction, removeEmptyParents } from './managed-files.mjs';

const SKILL_RESOURCES=['references/tool-contracts.md'];
const entry = source => parse(source || '').mcp_servers?.handoffglass;
function destinations({userHome=homedir(),codexHome=process.env.CODEX_HOME || join(userHome,'.codex')}={}) {
  return {userHome,codexHome,configPath:join(codexHome,'config.toml'),
    skillPath:join(userHome,'.agents','skills','visual-handoff','SKILL.md'),
    receiptPath:join(codexHome,'handoffglass-install.json')};
}
const ownTable = line => /^[ \t]*\[mcp_servers\.handoffglass(?:\.[A-Za-z0-9_-]+)*\][ \t]*(?:#.*)?(?:\r?\n)?$/.test(line);
function splitEntry(source) {
  let own=false;const kept=[],block=[];
  for(const line of (source||'').split(/(?<=\n)/)){
    if(/^[ \t]*\[/.test(line))own=ownTable(line);
    (own?block:kept).push(line);
  }
  return {remaining:kept.join(''),block:block.join('')};
}
function sameEntry(current,installed){
  return isDeepStrictEqual(entry(current),entry(installed)) && splitEntry(current).block.trim()===splitEntry(installed).block.trim();
}
/** Only generated tables are sliced; parsing proves unrelated values survive. */
function withoutEntry(source) {
  const expected=parse(source||'');
  if(expected.mcp_servers)delete expected.mcp_servers.handoffglass;
  const next=splitEntry(source).remaining,actual=parse(next);
  for(const value of [expected,actual])if(value.mcp_servers&&!Object.keys(value.mcp_servers).length)delete value.mcp_servers;
  if(!isDeepStrictEqual(actual,expected))throw new Error('Nonstandard TOML layout; preserving configuration');
  return next;
}
async function readReceipt(path) {
  const raw=await readManagedFile(path);
  if (raw===null) return {raw,receipt:null};
  let receipt;
  try { receipt=JSON.parse(raw); } catch { throw new Error('Invalid installation record'); }
  if (receipt.schemaVersion!==1 || receipt.host!=='codex' || !Array.isArray(receipt.backups) ||
      !['config','skill'].every(k=>receipt[k] && ['before','installed'].every(f=>receipt[k][f]===null || typeof receipt[k][f]==='string')) ||
      (receipt.resources && (Object.keys(receipt.resources).some(k=>!SKILL_RESOURCES.includes(k)) || Object.values(receipt.resources).some(v=>!v || !['before','installed'].every(f=>v[f]===null||typeof v[f]==='string')))) ||
      receipt.backups.some(b=>!/^config\.toml\.handoffglass-backup-[a-f0-9-]+$/.test(b.name)||typeof b.content!=='string'))
    throw new Error('Invalid installation record');
  return {raw,receipt};
}
export async function installCodex(options={}) {
  const {configOptions={},replace=false,apply=false}=options;
  const p=destinations(options);
  const [priorConfig,priorSkill,skill,record]=await Promise.all([
    readManagedFile(p.configPath),readManagedFile(p.skillPath),
    readFile(new URL('../skills/visual-handoff/SKILL.md',import.meta.url),'utf8'),readReceipt(p.receiptPath)
  ]);
  const resources=await Promise.all(SKILL_RESOURCES.map(async name=>({name,path:join(dirname(p.skillPath),name),
    prior:await readManagedFile(join(dirname(p.skillPath),name)),next:await readFile(new URL('../skills/visual-handoff/'+name,import.meta.url),'utf8')})));
  for(const resource of resources){
    const saved=record.receipt?.resources?.[resource.name];
    if(saved && resource.prior!==saved.installed)throw new Error('Installed resource was changed; preserving user edits');
    if(!saved && resource.prior!==null && resource.prior!==resource.next && !replace)throw new Error('Skill resource exists; use --replace deliberately');
  }
  const nextConfig=mergeHostToml(priorConfig || '',{replace,configOptions});
  if (priorSkill!==null && priorSkill!==skill && !replace) throw new Error('visual-handoff is already installed; use --replace to update deliberately');
  // A managed update may replace our last installed version, never an unrecorded edit.
  if (record.receipt && (priorSkill!==record.receipt.skill.installed || !sameEntry(priorConfig,record.receipt.config.installed)))
    throw new Error('Installed content was changed; preserving user edits');
  const changes=[{path:p.skillPath,prior:priorSkill,next:skill},{path:p.configPath,prior:priorConfig,next:nextConfig},...resources].filter(f=>f.prior!==f.next);
  if (apply && (changes.length || !record.receipt)) {
    const receipt=record.receipt || {schemaVersion:1,host:'codex',config:{before:priorConfig},skill:{before:priorSkill},backups:[]};
    receipt.config.installed=nextConfig;receipt.skill.installed=skill;receipt.resources??={};
    for(const resource of resources){receipt.resources[resource.name]??={before:resource.prior};receipt.resources[resource.name].installed=resource.next;}
    if (changes.some(f=>f.path===p.configPath) && priorConfig!==null) {
      const backup={name:`config.toml.handoffglass-backup-${randomUUID()}`,content:priorConfig};
      receipt.backups.push(backup);changes.push({path:join(p.codexHome,backup.name),prior:null,next:priorConfig});
    }
    changes.push({path:p.receiptPath,prior:record.raw,next:JSON.stringify(receipt,null,2)+'\n'});
    await applyFileTransaction(changes);
  }
  return {applied:apply,changed:changes.length>0,configPath:p.configPath,skillPath:p.skillPath};
}
export async function uninstallCodex(options={}) {
  const {apply=false}=options,p=destinations(options);
  const [config,skill,record]=await Promise.all([readManagedFile(p.configPath),readManagedFile(p.skillPath),readReceipt(p.receiptPath)]);
  const changes=[],retained=[],receipt=record.receipt;
  if (!receipt) return {applied:false,changed:false,state:entry(config)!==undefined||skill!==null?'unmanaged':'not_installed',removed:[],retained:[],items:[]};
  let nextConfig=config;
  if (config===receipt.config.installed) nextConfig=receipt.config.before;
  else if (config!==null && sameEntry(config,receipt.config.installed)) {
    const remaining=withoutEntry(config);
    const priorEntry=receipt.config.before===null?undefined:entry(receipt.config.before);
    if (priorEntry===undefined) nextConfig=remaining;
    else {
      // Recover the prior entry without rewriting unrelated TOML.
      const priorSource=receipt.config.before;withoutEntry(priorSource);
      const {block}=splitEntry(priorSource);
      if(!block)throw new Error('Cannot restore prior configuration');
      nextConfig=remaining+'\n'+block;
      const expected=parse(remaining);expected.mcp_servers??={};expected.mcp_servers.handoffglass=priorEntry;
      if(!isDeepStrictEqual(parse(nextConfig),expected)) throw new Error('Cannot restore prior configuration');
    }
  } else if (isDeepStrictEqual(entry(config),entry(receipt.config.before))) { /* Already restored. */ }
  else if (entry(config)!==undefined) retained.push({path:p.configPath,kind:'mcp_entry',reason:'changed_by_user'});
  if (nextConfig!==config) changes.push({path:p.configPath,prior:config,next:nextConfig,kind:'mcp_entry',action:receipt.config.before===null?'remove':'restore'});
  if (skill===receipt.skill.installed && skill!==receipt.skill.before) changes.push({path:p.skillPath,prior:skill,next:receipt.skill.before,kind:'skill',action:receipt.skill.before===null?'remove':'restore'});
  else if (skill!==null && skill!==receipt.skill.before) retained.push({path:p.skillPath,kind:'skill',reason:'changed_by_user'});
  for(const name of SKILL_RESOURCES){
    const saved=receipt.resources?.[name];if(!saved)continue;
    const path=join(dirname(p.skillPath),name),current=await readManagedFile(path);
    if(current===saved.installed && current!==saved.before)changes.push({path,prior:current,next:saved.before,kind:'skill_resource',action:saved.before===null?'remove':'restore'});
    else if(current!==null && current!==saved.before)retained.push({path,kind:'skill_resource',reason:'changed_by_user'});
  }
  for (const backup of receipt.backups) {
    const path=join(p.codexHome,backup.name),current=await readManagedFile(path);
    if (current===backup.content) changes.push({path,prior:current,next:null,kind:'backup',action:'remove'});
    else if (current!==null) retained.push({path,kind:'backup',reason:'changed_by_user'});
  }
  if (!retained.length) changes.push({path:p.receiptPath,prior:record.raw,next:null,kind:'installation_record',action:'remove'});
  if (apply && changes.length) {
    await applyFileTransaction(changes);
    for (const f of changes) if(f.next===null) await removeEmptyParents(f.path,f.path.startsWith(dirname(p.skillPath)+sep)?join(p.userHome,'.agents','skills'):p.codexHome);
  }
  return {applied:apply&&changes.length>0,changed:changes.length>0,state:retained.length?'modified':'installed',configPath:p.configPath,skillPath:p.skillPath,
    removed:changes.map(f=>f.path),retained,items:changes.map(({path,kind,action})=>({path,kind,action}))};
}
