/** OpenCode v2 Promise plugin; schemas and handlers remain shared with MCP. */
import {Plugin} from '@opencode/plugin'
import {nativeTools} from './runtime/src/hosts/native-tools.mjs'
export default Plugin.define({
 id:'handoffglass',
 async setup(ctx){
  const tools=nativeTools('opencode')
  try{
   await ctx.tool.transform(editor=>{
    editor.namespace({name:'handoffglass',description:'Host observation, local drawing and human-guided steps'})
    for(const spec of tools.definitions)editor.add({name:spec.name,description:spec.description,input:spec.input,options:{namespace:'handoffglass'},
     execute:async(args,context)=>({content:JSON.stringify(await tools.execute(spec.name,args,{identity:context.sessionID,signal:context.signal}))})})
   })
   await ctx.session.hook('context',event=>{event.system.push({type:'text',text:tools.instructions})})
  }catch(error){tools.close();throw error}
  return ()=>tools.close()
 }
})
