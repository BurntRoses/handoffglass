/** DSH native adapter. Effect-owned registrations; canonical structured outputs. */
import type { Context } from '@deepseek-ai/cordis'
import {nativeTools} from '../runtime/src/hosts/native-tools.mjs'
export const name='handoffglass-cordis'
export const inject=['tools']
export function apply(ctx:Context){
 const tools=nativeTools('deepseek')
 // Raw JSON Schema registration is supported by DSH. The shared executor validates with Zod.
 for(const spec of tools.definitions)ctx.tools.register({
  name:'handoffglass_'+spec.name,description:spec.description,parameters:spec.input,
  output:{schema:{type:'object',additionalProperties:true},render:(_args:unknown,value:unknown)=>[{type:'text',text:JSON.stringify(value)}]},
  async execute(args:unknown,exec:any){return tools.execute(spec.name,args,{identity:exec.agent,signal:exec.signal})}
 })
 ctx.effect(()=>()=>tools.close())
}
