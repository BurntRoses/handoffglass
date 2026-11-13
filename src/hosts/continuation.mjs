/** Process-local native event delivery. It never verifies or replays an action. */
/** @typedef {{sessionId:string,step:number,cursor:number,events:string[],nextAction:string}} ContinuationNotice */
const terminal=new Set(['completed','declined','cancelled','expired','superseded']);
const decisions=new Set(['user_action','verification_required','target_lost','display_changed','desktop_unavailable','permission_required','connection_changed','recovery_requested']);
export function continuationMessage(notice){
  return `HandoffGlass event ${JSON.stringify(notice)}. Continue only this owned session. Independently observe the original application before session_verify; a user report is not proof. Never replay a user action or reopen a refusal. If observation is unavailable use result:inconclusive. Do not repeat the desktop card in chat.`;
}
export function createContinuation({broker,deliver,onError=()=>{},waitSeconds=25}){
  let session=null,cursor=0,controller=null,task=null,closed=false,generation=0,lastNotice='';
  const stop=()=>{generation++;controller?.abort();controller=null;};
  const running=s=>s&&s.execution==='attached'&&!terminal.has(s.status)&&s.status!=='paused';
  const pump=async(epoch,signal)=>{
    const client=broker.withSignal?broker.withSignal(signal):broker;
    while(!signal.aborted&&!closed&&epoch===generation&&running(session)){
      let result;
      try{result=await client.wait(session.id,waitSeconds,{continuous:true,cursor});}
      catch(error){if(!signal.aborted)onError(error);break;}
      if(signal.aborted||closed||epoch!==generation)break;
      // Updates to a later step from a concurrent tool result take precedence.
      if(result.session?.id!==session.id){onError(Object.assign(Error('Native event owner changed'),{code:'binding_conflict'}));break;}
      if((result.session.step??1)<(session.step??1)||result.session.updatedAt<session.updatedAt)continue;
      session=result.session;
      const previous=cursor;
      if(Number.isSafeInteger(result.nextCursor))cursor=Math.max(cursor,result.nextCursor);
      if(!running(session))break;
      const events=(result.events??[]).filter(event=>event.sessionId===session.id&&Number.isSafeInteger(event.sequence??event.cursor)&&(event.sequence??event.cursor)>previous&&decisions.has(event.type));
      if(!events.length)continue;
      const types=[...new Set(events.map(event=>event.type))];
      const key=`${session.id}:${session.step}:${session.status}:${session.nextAction}`;
      if(key===lastNotice)continue;
      const notice={sessionId:session.id,step:session.step??1,cursor,events:types,nextAction:session.nextAction};
      // Commit before delivery: a failed/ambiguous host admission is not retried.
      lastNotice=key;
      try{await deliver(notice,signal);}catch(error){if(!signal.aborted)onError(error);break;}
    }
  };
  return {
    update(result){
      const next=result?.session;if(!next?.id)return;
      const changed=session?.id!==next.id;
      if(changed){stop();cursor=0;lastNotice='';}
      if(!changed&&(next.step??1)<(session.step??1))return;
      session=next;
      if(Number.isSafeInteger(result.nextCursor))cursor=Math.max(cursor,result.nextCursor);
      if(!running(session)||typeof deliver!=='function'){stop();return;}
      if(controller)return;
      controller=new AbortController();const epoch=generation,signal=controller.signal;
      task=Promise.resolve().then(()=>pump(epoch,signal)).finally(()=>{if(epoch===generation)controller=null;});
    },
    get session(){return session;},
    get cursor(){return cursor;},
    async phase(phase){
      if(closed||!running(session))return;
      const result=await broker.control(session.id,'progress',phase,session.step);this.update(result);
    },
    async interrupt(){
      stop();if(!session||terminal.has(session.status))return;
      const result=await broker.control(session.id,'pause',undefined,session.step);session=result.session??session;
    },
    async close({cancel=true}={}){
      closed=true;stop();
      if(cancel&&session&&session.execution!=='parked'&&!terminal.has(session.status)){
        try{await broker.cancel(session.id);}catch(error){onError(error);}
      }
      await task;
    }
  };
}
