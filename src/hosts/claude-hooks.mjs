/** Optional Claude Code command hooks; no transcript or tool-input inspection. */
import {handleCodexHook} from './codex-hooks.mjs';
export async function handleClaudeHook(input,options={}){
  const event=input?.hook_event_name;
  if(!['SessionStart','UserPromptSubmit','PreToolUse','PostToolUse','Stop','SessionEnd'].includes(event))return {};
  const env={...(options.env??process.env),HANDOFFGLASS_HOST_ID:'claude-code'};
  const mapped=event==='UserPromptSubmit'?{...input,hook_event_name:'PreModelRequest'}:input;
  return handleCodexHook(mapped,{...options,env,host:'claude-code'});
}
export async function runClaudeHook({env=process.env,stdin=process.stdin,stdout=process.stdout}={}){
  try{
    let text='';for await(const chunk of stdin){text+=chunk;if(Buffer.byteLength(text)>262144){stdout.write('{}\n');return;}}
    stdout.write(JSON.stringify(await handleClaudeHook(JSON.parse(text||'{}'),{env}))+'\n');
  }catch{stdout.write('{}\n');}
}
