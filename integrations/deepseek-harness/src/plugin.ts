/** Targets Cordis 4.1.0 / DSH 0.2.2-rc.2; acceptance is recorded separately. */
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { createUserMessage } from '@deepseek-ai/dsh-llm/message'
import { readFile } from 'node:fs/promises'
import { nativeTools } from '../runtime/src/hosts/native-tools.mjs'
import { continuationMessage } from '../runtime/src/hosts/continuation.mjs'
export const name='handoffglass-cordis'
export const inject=['tools','agents']
declare module '@deepseek-ai/dsh-llm/message' {
 interface MessageSourceMap {'handoffglass':{kind:'handoffglass'}}
}
const message=(text:string)=>createUserMessage({content:[{type:'text',text}],source:{kind:'handoffglass'}})
export async function apply(ctx:Context){
 const {env={}}=JSON.parse(await readFile(new URL('../connection.json',import.meta.url),'utf8'))
 const signals=new Map<Agent,{signal:AbortSignal,abort:()=>void}>()
 const tools=nativeTools('deepseek',{env:{...process.env,...env},
  deliver:async(agent:Agent,notice:unknown,signal:AbortSignal)=>{
   signal.throwIfAborted()
   agent.followup(message(continuationMessage(notice)))
  }})
 const bestEffort=(work:Promise<unknown>)=>{void work.catch(()=>{})}
 for(const spec of tools.definitions)ctx.tools.register({
  name:'handoffglass_'+spec.name,description:spec.description,parameters:spec.input,
  output:{schema:{type:'object',additionalProperties:true},render:(_args:unknown,value:unknown)=>[{type:'text',text:JSON.stringify(value)}]},
  async execute(args:unknown,exec:ToolRunContext){
   if(!exec.agent)throw Error('HandoffGlass needs the current live Agent identity')
   return tools.execute(spec.name,args,{identity:exec.agent,signal:exec.signal})
  }
 })
 ctx.on('agent/created',({agent})=>{
  agent.inject(message(tools.instructions+' Attached guidance delivers decision events to this Agent. Parked guidance never wakes it.'))
  return undefined
 })
 ctx.on('agent/pre-step',async({agent,signal},next)=>{
  const prior=signals.get(agent)
  if(prior?.signal!==signal){
   prior?.signal.removeEventListener('abort',prior.abort)
   const abort=()=>bestEffort(tools.interrupt(agent));signals.set(agent,{signal,abort})
   signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort()
  }
  await tools.phase(agent,'thinking')
  return next()
 })
 ctx.on('agent/status',({agent,status})=>{bestEffort(tools.phase(agent,status==='running'?'thinking':'idle'))})
 ctx.on('agent/disposed',({agent})=>{
  const prior=signals.get(agent);prior?.signal.removeEventListener('abort',prior.abort);signals.delete(agent)
  bestEffort(tools.release(agent))
 })
 ctx.effect(()=>async()=>{
  for(const {signal,abort}of signals.values())signal.removeEventListener('abort',abort)
  signals.clear();await tools.close()
 })
}
