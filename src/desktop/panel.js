'use strict';
let active=null,busy=false;
const $=id=>document.getElementById(id);
const UI=Object.freeze({
 'zh-CN':{remaining:n=>`剩余 ${n} 秒`,guide:'操作指引',handoff:'需要你操作',done:'我已完成',ack:'知道了',decline:'拒绝',cancel:'取消',sending:'正在提交…',note:'请在原始窗口核对内容，完成后再确认。',phase:'AGENT → HUMAN'},
 'en-US':{remaining:n=>`${n}s remaining`,guide:'Guidance',handoff:'Your turn',done:'I completed this',ack:'Got it',decline:'Decline',cancel:'Cancel',sending:'Sending…',note:'Review the original window before confirming.',phase:'AGENT → HUMAN'}
});
function copyFor(session){return UI[session?.locale]||UI['zh-CN'];}
function updateTimer(){if(!active)return;const seconds=Math.max(0,Math.ceil((active.timeoutAt-Date.now())/1000));$('timer').textContent=copyFor(active).remaining(seconds);}
function render(session){
 active=session;busy=false;for(const id of ['done','decline','cancel'])$(id).disabled=false;
 if(!session)return;
 const copy=copyFor(session);
 document.documentElement.lang=UI[session.locale]?session.locale:'en-US';
 document.documentElement.dataset.theme=['light','dark'].includes(session.theme)?session.theme:'system';
 $('panel').dataset.density=session.density==='compact'?'compact':'normal';
 $('tag').textContent=session.mode==='guide'?'GUIDANCE':'HANDOFF';
 $('status').textContent=session.mode==='guide'?copy.guide:copy.handoff;
 $('phase').textContent=copy.phase;
 $('title').textContent=session.title;
 $('message').textContent=session.message;
 $('doneLabel').textContent=session.mode==='guide'?copy.ack:copy.done;
 $('decline').textContent=copy.decline;$('decline').hidden=session.mode==='guide';
 $('cancel').textContent=copy.cancel;$('note').textContent=copy.note;
 updateTimer();
}
window.handoffglass.onRender(render);
for(const [id,decision] of Object.entries({done:'completed',decline:'declined',cancel:'cancelled'})){
 $(id).addEventListener('click',async()=>{
  if(!active||busy)return;
  const requestedId=active.id;busy=true;
  for(const key of ['done','decline','cancel'])$(key).disabled=true;
  $('status').textContent=copyFor(active).sending;
  let reply;
  try{reply=await window.handoffglass.decide(requestedId,decision);}catch{reply={ok:false,error:'Local connection failed'};}
  if(active?.id!==requestedId)return;
  if(!reply?.ok){$('status').textContent=reply?.error||'Could not send';busy=false;for(const key of ['done','decline','cancel'])$(key).disabled=false;}
  // Only the broker's next state may close the panel.
 });
}
setInterval(updateTimer,1000);
