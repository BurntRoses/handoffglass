/** OpenCode 2.2.7 Promise API; no V1 lifecycle names or cross-session delivery. */
import {Plugin} from '@opencode/plugin'
import {readFile} from 'node:fs/promises'
import {nativeTools} from './runtime/src/hosts/native-tools.mjs'
import {continuationMessage} from './runtime/src/hosts/continuation.mjs'
export default Plugin.define({
 id:'handoffglass',
 async setup(ctx){
  const {env={}}=JSON.parse(await readFile(new URL('./connection.json',import.meta.url),'utf8'))
  const controller=new AbortController(),registrations:Array<{dispose():Promise<void>}>=[]
  const tools=nativeTools('opencode',{env:{...process.env,...env},deliver:async(sessionID:string,notice:unknown,signal:AbortSignal)=>{
   signal.throwIfAborted()
   await ctx.session.prompt({sessionID,text:continuationMessage(notice),delivery:'queue'},{signal})
  }})
  const cleanup=async()=>{controller.abort();await tools.close();await Promise.allSettled(registrations.map(r=>r.dispose()))}
  try{
   registrations.push(await ctx.tool.transform(editor=>{
    editor.namespace({name:'handoffglass',description:'Host observation, local drawing and human-guided steps'})
    for(const spec of tools.definitions)editor.add({name:spec.name,description:spec.description,input:spec.input,options:{namespace:'handoffglass'},
     execute:async(args,context)=>({content:JSON.stringify(await tools.execute(spec.name,args,{identity:context.sessionID,signal:context.signal}))})})
   }))
   registrations.push(await ctx.session.hook('context',async event=>{
    event.system.push({type:'text',text:tools.instructions+' Attached guidance delivers decision events to this session. Parked guidance does not resume execution.'})
    await tools.phase(event.sessionID,'thinking')
   }))
   registrations.push(await ctx.tool.hook('execute.before',async event=>{
    if(event.tool.startsWith('handoffglass'))await tools.phase(event.sessionID,event.tool.endsWith('session_verify')?'verifying':'presenting')
   }))
   void(async()=>{
    for await(const event of ctx.event.subscribe({types:['session.deleted','session.execution.interrupted','session.execution.succeeded','session.execution.failed'],signal:controller.signal})){
     if(event.type==='session.deleted')await tools.release(event.data.sessionID)
     else if(event.type==='session.execution.interrupted'||event.type==='session.execution.failed')await tools.interrupt(event.data.sessionID)
     else await tools.phase(event.data.sessionID,'idle')
    }
   })().catch(()=>{controller.abort()})
  }catch(error){await cleanup();throw error}
  return cleanup
 }
})
