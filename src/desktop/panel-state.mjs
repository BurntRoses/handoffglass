/** Derive feedback from recorded activity; waiting never implies model work. */
export function panelState(s,now=Date.now()) {
  if(!s)return {key:'idle',tone:'quiet',working:false};
  if(s.desktopConnection==='reconnecting')return {key:'reconnecting',tone:'warning',working:false};
  if(s.status==='paused')return {key:'paused',tone:'quiet',working:false};
  if(s.phase==='blocked')return {key:['consent_required','permission_denied'].includes(s.targetTracking?.reason)?'permission':'lost',tone:'warning',working:false};
  if(s.phase==='reconnecting')return {key:'reconnecting',tone:'warning',working:false};
  const phase=s.agentState?.phase;
  const fresh=Number.isFinite(s.agentState?.at)&&now>=s.agentState.at&&now-s.agentState.at<30000;
  const working=s.execution!=='parked'&&fresh&&['thinking','observing','locating','presenting','verifying'].includes(phase);
  if(working)return {key:phase,tone:'active',working:true};
  if(s.phase==='verifying')return {key:s.execution==='parked'?'parkedSubmitted':'submitted',tone:'recorded',working:false};
  if(s.phase==='next_step')return {key:'next',tone:'quiet',working:false};
  return {key:s.demo?'trial':'waiting',tone:'ready',working:false};
}
