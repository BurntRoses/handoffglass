/** Fixed contents of the local connector; shared by the builder and cleanup. */
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readManagedFile, digest, applyFileTransaction } from './managed-files.mjs';

export const WORKBUDDY_FILES = Object.freeze([
  'connector-meta.json', 'icon.svg', 'mcp.json', 'skills/visual-handoff/SKILL.md',
  'skills/visual-handoff/references/tool-contracts.md', '.handoffglass-managed'
]);

export async function readWorkbuddyRecord(bundle) {
  const path = join(bundle, 'handoffglass-files.json');
  const raw = await readManagedFile(path);
  if (raw === null) return { path, raw, record: null };
  let record;
  try { record = JSON.parse(raw); } catch { throw new Error('Invalid connector installation record'); }
  if (record.schemaVersion !== 1 || record.host !== 'workbuddy' || !record.files ||
      Object.keys(record.files).length !== WORKBUDDY_FILES.length ||
      !WORKBUDDY_FILES.every(file => /^[a-f0-9]{64}$/.test(record.files[file])))
    throw new Error('Invalid connector installation record');
  return { path, raw, record };
}

export async function writeWorkbuddyBundle(bundle, contents) {
  if (Object.keys(contents).length !== WORKBUDDY_FILES.length ||
      !WORKBUDDY_FILES.every(file => typeof contents[file] === 'string'))
    throw new TypeError('Invalid connector contents');
  const saved = await readWorkbuddyRecord(bundle);
  const changes = [], files = {};
  for (const file of WORKBUDDY_FILES) {
    const path = join(bundle, file), prior = await readManagedFile(path), next = contents[file];
    if (prior !== null && (!saved.record || digest(prior) !== saved.record.files[file]))
      throw new Error(`Connector file is unrecorded or changed; preserving it: ${file}`);
    files[file] = digest(next);
    if (prior !== next) changes.push({ path, prior, next });
  }
  const next = JSON.stringify({ schemaVersion: 1, host: 'workbuddy', files }, null, 2) + '\n';
  if (next !== saved.raw) changes.push({ path: saved.path, prior: saved.raw, next });
  await applyFileTransaction(changes);
  return { changed: changes.length > 0 };
}

export async function prepareWorkbuddyBundle(destination, {command=process.execPath,
  entry=fileURLToPath(new URL('./mcp.mjs',import.meta.url)),envOverrides={}}={}) {
  const config={mcpServers:{handoffglass:{type:'stdio',command,args:[entry],
    env:{...envOverrides,HANDOFFGLASS_HOST_ID:'workbuddy',HANDOFFGLASS_OUTPUT:'compact'},
    runtime:{type:'node',version:'22'},timeout:60000}}};
  const contents={'mcp.json':JSON.stringify(config,null,2)+'\n','.handoffglass-managed':'handoffglass-local-v1\n'};
  for(const name of ['connector-meta.json','icon.svg'])
    contents[name]=await readFile(new URL('../integrations/workbuddy/'+name,import.meta.url),'utf8');
  for(const name of ['SKILL.md','references/tool-contracts.md'])
    contents['skills/visual-handoff/'+name]=await readFile(new URL('../skills/visual-handoff/'+name,import.meta.url),'utf8');
  return {destination,...await writeWorkbuddyBundle(destination,contents),hostCode:'workbuddy',serverCount:1,published:false};
}
