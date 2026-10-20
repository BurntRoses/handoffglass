/** Fixed local destinations; renderer callers cannot choose a path or command. */
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { readFile, lstat, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { mergeHostToml } from './host-install.mjs';

async function readPrivateFile(path) {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('Refusing to replace a symlink or non-file');
    return await readFile(path,'utf8');
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function atomicUpdate(file) {
  const {path,prior,next}=file;
  await mkdir(dirname(path),{recursive:true,mode:0o700});
  if (await readPrivateFile(path) !== prior) throw new Error('Configuration changed during installation; retry');
  if (prior !== null) await writeFile(`${path}.handoffglass-backup-${randomUUID()}`,prior,{flag:'wx',mode:0o600});
  const temp=join(dirname(path),`.handoffglass-${randomUUID()}.tmp`);
  try {
    await writeFile(temp,next,{flag:'wx',mode:0o600});
    await rename(temp,path);
  } finally { await rm(temp,{force:true}); }
}
export async function installCodex({ userHome=homedir(), codexHome=process.env.CODEX_HOME || join(userHome,'.codex'),
  configOptions={}, replace=false, apply=false }={}) {
  const configPath=join(codexHome,'config.toml');
  const skillPath=join(userHome,'.agents','skills','visual-handoff','SKILL.md');
  const [priorConfig,priorSkill,skill]=await Promise.all([
    readPrivateFile(configPath),readPrivateFile(skillPath),
    readFile(new URL('../skills/visual-handoff/SKILL.md',import.meta.url),'utf8')
  ]);
  const nextConfig=mergeHostToml(priorConfig || '',{replace,configOptions});
  if (priorSkill !== null && priorSkill !== skill && !replace)
    throw new Error('visual-handoff is already installed; use --replace to update deliberately');
  const changes=[{path:skillPath,prior:priorSkill,next:skill},{path:configPath,prior:priorConfig,next:nextConfig}]
    .filter(file=>file.prior !== file.next);
  if (apply) for (const file of changes) await atomicUpdate(file);
  return { applied:apply, changed:changes.length>0, configPath, skillPath };
}
