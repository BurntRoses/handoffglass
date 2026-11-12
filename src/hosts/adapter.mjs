/** Shared host contract. Observation and continuation belong to the host, never the renderer. */
import {BrokerClient} from '../runtime.mjs';
import {observedTarget} from '../visual/observed-region.mjs';
export const HARNESS_ORDER=Object.freeze(['codex','claude-code','deepseek','workbuddy','cursor','trae','opencode']);
export function createHostAdapter(host,{broker=new BrokerClient({env:{...process.env,HANDOFFGLASS_HOST_ID:host}}),observe,verify,resume}={}){
  if(!HARNESS_ORDER.includes(host))throw new TypeError('Unsupported local host');
  const owned=new Map();
  return Object.freeze({
    host,
    async observe(context){
      if(typeof observe!=='function')return {error:'host_observation_required',nextAction:'use_authorized_host_observation'};
      const evidence=await observe(context);
      if(!evidence)return {error:'observation_unavailable',coordinateFree:true};
      return {target:observedTarget(evidence.bounds,evidence.frame,evidence.displays,{observation:evidence.observation,layoutSignature:evidence.layoutSignature})};
    },
    async present(args){
      const result=await broker.present(args.mode??'handoff',{...args,continuous:true,execution:args.execution??'parked'});
      if(result.session){owned.set(result.session.id,result.session);while(owned.size>64)owned.delete(owned.keys().next().value);}
      return result;
    },
    async await_user({sessionId,cursor=0,timeoutSeconds=20}){
      const result=await broker.wait(sessionId,timeoutSeconds,{continuous:true,cursor});
      if(result.session)owned.set(sessionId,result.session);return result;
    },
    async verify({sessionId,finish=false,expectedStep}){
      if(!owned.has(sessionId))return {error:'not_found'};
      let result='inconclusive';
      if(typeof verify==='function'){
        try{result=await verify({sessionId,expectedStep});}catch{result='inconclusive';}
      }
      if(!['verified','mismatch','inconclusive'].includes(result))throw new TypeError('Host verification must return one of three results');
      const outcome=await broker.verify(sessionId,result,finish,expectedStep);
      if(outcome.session)owned.set(sessionId,outcome.session);return outcome;
    },
    async resume({sessionId,resumeToken}){
      if(resumeToken){const recovered=await broker.resume(sessionId,resumeToken);if(recovered.session)owned.set(sessionId,recovered.session);return recovered;}
      const session=owned.get(sessionId);
      if(!session?.verified)return {error:'independent_verification_required'};
      if(typeof resume!=='function')return {session,nextAction:'return_to_host',hostWakeup:false};
      return resume({sessionId,verification:session.verification});
    }
  });
}
