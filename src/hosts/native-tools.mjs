/** Native wrappers reuse MCP schemas/handlers; one Broker owner per host chat. */
import * as z from 'zod/v4';
import {toolCatalog,SERVER_INSTRUCTIONS} from '../mcp.mjs';
import {BrokerClient} from '../runtime.mjs';
import {createContinuation} from './continuation.mjs';
/**
 * @template {object|string} Identity
 * @param {string} host
 * @param {{env?:NodeJS.ProcessEnv,deliver?:(identity:Identity,notice:import('./continuation.mjs').ContinuationNotice,signal:AbortSignal)=>void|Promise<void>,onError?:(error:unknown)=>void,clientFactory?:()=>BrokerClient}} [options]
 */
export function nativeTools(host,{env=process.env,deliver,onError,clientFactory=()=>new BrokerClient({env:{...env,HANDOFFGLASS_HOST_ID:host,HANDOFFGLASS_EMBEDDED_RENDERER:'1'}})}={}){
  const descriptions=toolCatalog(undefined),scopes=new Map();
  let closed=false;
  const definitions=[...descriptions.values()].map(({name,description,inputSchema})=>({name,description,input:z.toJSONSchema(inputSchema,{io:'input'})}));
  return {instructions:SERVER_INSTRUCTIONS,definitions,
    async execute(name,args,{identity,signal}={}){
      signal?.throwIfAborted();
      if(closed)throw Error('Plugin disposed');
      const spec=descriptions.get(name);if(!spec)throw Error('Unknown HandoffGlass tool');
      if(!identity||!['object','string'].includes(typeof identity))throw Error('Host chat identity is required');
      let scope=scopes.get(identity);
      if(!scope){
        if(scopes.size>=256)throw Error('Host chat limit reached; reload the plugin');
        const broker=clientFactory();scope={broker,continuation:createContinuation({broker,onError,deliver:deliver?(notice,signal)=>deliver(identity,notice,signal):undefined})};scopes.set(identity,scope);
      }
      const {broker}=scope;
      const scoped=broker.withSignal?broker.withSignal(signal):broker;
      const tool=toolCatalog(scoped).get(name),result=await tool.handler(spec.inputSchema.parse(args));
      if(signal?.aborted)signal.throwIfAborted();
      if(result.isError||result.structuredContent?.error)throw Object.assign(Error(result.structuredContent.error),{code:result.structuredContent.code??result.structuredContent.error,...(result.structuredContent.nextAction?{nextAction:result.structuredContent.nextAction}:{})});
      scope.continuation.update(result.structuredContent);
      return result.structuredContent;
    },
    async phase(identity,phase){await scopes.get(identity)?.continuation.phase(phase);},
    async interrupt(identity){await scopes.get(identity)?.continuation.interrupt();},
    async release(identity,options){const scope=scopes.get(identity);scopes.delete(identity);await scope?.continuation.close(options);},
    async close(){closed=true;const prior=[...scopes.values()];scopes.clear();await Promise.allSettled(prior.map(scope=>scope.continuation.close()));}
  };
}
