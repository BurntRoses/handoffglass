#!/usr/bin/env node
/** Build a *local-development* WorkBuddy MCP+Skill connector. Never publish local paths. */
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
const base=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const destination=process.argv[2] ? resolve(process.argv[2]) : join(base,'dist/workbuddy-local');
await mkdir(join(destination,'skills/visual-handoff'),{recursive:true});
const config={mcpServers:{handoffglass:{type:'stdio',command:process.execPath,args:[join(base,'src/mcp.mjs')],
  runtime:{type:'node',version:'22'},timeout:30000}}};
for(const name of ['connector-meta.json','icon.svg']) await copyFile(join(base,'integrations/workbuddy',name),join(destination,name));
await writeFile(join(destination,'mcp.json'),JSON.stringify(config,null,2)+'\n');
const skill=await readFile(join(base,'skills/visual-handoff/SKILL.md'),'utf8');
await writeFile(join(destination,'skills/visual-handoff/SKILL.md'),skill);
console.log(JSON.stringify({destination,mode:'local development only',published:false,hostCode:'workbuddy',serverCount:1},null,2));
