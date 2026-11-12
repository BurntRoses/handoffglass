/** Native wrappers reuse MCP schemas/handlers; one Broker owner per host chat. */
import * as z from 'zod/v4';
import {toolCatalog,SERVER_INSTRUCTIONS} from '../mcp.mjs';
import {BrokerClient} from '../runtime.mjs';
export function nativeTools(host,{clientFactory=()=>new BrokerClient({env:{...process.env,HANDOFFGLASS_HOST_ID:host,HANDOFFGLASS_EMBEDDED_RENDERER:'1'}})}={}){
  const descriptions=toolCatalog(undefined),objects=new WeakMap(),strings=new Map();
  let closed=false;
  const definitions=[...descriptions.values()].map(({name,description,inputSchema})=>({name,description,input:z.toJSONSchema(inputSchema,{io:'input'})}));
  return {instructions:SERVER_INSTRUCTIONS,definitions,
    async execute(name,args,{identity,signal}={}){
      signal?.throwIfAborted();
      if(closed)throw Error('Plugin disposed');
      const spec=descriptions.get(name);if(!spec)throw Error('Unknown HandoffGlass tool');
      if(!identity||!['object','string'].includes(typeof identity))throw Error('Host chat identity is required');
      const map=typeof identity==='object'?objects:strings;
      let broker=map.get(identity);
      if(!broker){if(map===strings&&strings.size>=256)throw Error('Host chat limit reached; reload the plugin');broker=clientFactory();map.set(identity,broker);}
      const scoped=broker.withSignal?broker.withSignal(signal):broker;
      const tool=toolCatalog(scoped).get(name),result=await tool.handler(spec.inputSchema.parse(args));
      if(signal?.aborted)signal.throwIfAborted();
      if(result.isError||result.structuredContent?.error)throw Object.assign(Error(result.structuredContent.error),{code:result.structuredContent.code??result.structuredContent.error,...(result.structuredContent.nextAction?{nextAction:result.structuredContent.nextAction}:{})});
      return result.structuredContent;
    },
    close(){closed=true;strings.clear();}
  };
}
