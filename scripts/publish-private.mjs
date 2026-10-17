#!/usr/bin/env node
// Optional explicit one-time publish action. Requires GitHub CLI (gh), authentication and git.
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function run(cmd,args,{capture=false,optional=false}={}){
 const p=spawnSync(cmd,args,{cwd:root,encoding:'utf8',stdio:capture?'pipe':'inherit'});
 if(p.error){if(optional)return null;throw new Error(`${cmd}: ${p.error.message}`);}
 if(p.status!==0){if(optional)return null;throw new Error(`${cmd} returned exit code ${p.status}: ${(p.stderr||'').slice(0,400)}`);}
 return capture?p.stdout.trim():'';
}
try{
 const owner=run('gh',['api','user','--jq','.login'],{capture:true});
 if(!owner||!/^[A-Za-z0-9-]+$/.test(owner))throw new Error('Unable to determine GitHub login from gh auth');
 const repo=`${owner}/handoffglass`;
 if(run('gh',['repo','view',repo],{optional:true})!==null)throw new Error(`${repo} already exists: stop rather than overwriting a repository`);
 const inside=run('git',['rev-parse','--show-toplevel'],{capture:true,optional:true});
 if(inside&&resolve(inside)!==root)throw new Error('The source folder is nested inside a different git repository');
 if(!inside)run('git',['init','-b','main']);
 if(!run('git',['config','user.name'],{capture:true,optional:true})||!run('git',['config','user.email'],{capture:true,optional:true})){
   throw new Error('Set your local git user.name and user.email first, then retry.');
 }
 run('git',['add','-A']);
 const changes=run('git',['diff','--cached','--name-only'],{capture:true});
 if(changes)run('git',['commit','-m','Initial private HandoffGlass prototype']);
 run('gh',['repo','create',repo,'--private','--source=.','--remote=origin','--push']);
 console.log(`Created and pushed private repository: https://github.com/${repo}`);
}catch(e){console.error('Publish was not completed:',e.message);process.exitCode=1;}
