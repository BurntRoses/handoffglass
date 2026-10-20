'use strict';
let active=null,busy=false;
const $=id=>document.getElementById(id);
const UI=Object.freeze({
 'zh-CN':{remaining:n=>`${n} 秒后结束`,done:'我已完成',ack:'知道了',decline:'拒绝',cancel:'取消',sending:'正在发送…',failed:'未能发送，请重试',lost:'目标位置已变化，请在原始窗口核对后操作。'},
 'en-US':{remaining:n=>`Ends in ${n}s`,done:'I completed this',ack:'Got it',decline:'Decline',cancel:'Cancel',sending:'Sending…',failed:'Could not send. Try again.',lost:'The target is no longer reliably located. Check the original window.'}
});
function copyFor(session){return UI[session?.locale]||UI['zh-CN'];}
function updateTimer(){if(!active)return;const seconds=Math.max(0,Math.ceil((active.timeoutAt-Date.now())/1000));$('timer').hidden=seconds>60;$('timer').textContent=copyFor(active).remaining(seconds);}
function render(session){
 active=session;busy=false;for(const id of ['done','decline','cancel'])$(id).disabled=false;
 if(!session)return;
 const copy=copyFor(session);
 document.documentElement.lang=UI[session.locale]?session.locale:'en-US';
 document.documentElement.dataset.theme=['light','dark'].includes(session.theme)?session.theme:'system';
 $('panel').dataset.density=session.density==='compact'?'compact':'normal';
 $('status').textContent='';
 $('title').textContent=session.title;
 $('message').textContent=session.message;
 $('doneLabel').textContent=session.mode==='guide'?copy.ack:copy.done;
 $('decline').textContent=copy.decline;$('decline').hidden=session.mode==='guide';
 $('cancel').setAttribute('aria-label',copy.cancel);const lost=Boolean(session.targetTracking&&session.targetTracking.status!=='tracking');$('note').hidden=!lost;$('note').textContent=lost?copy.lost:'';
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
  if(!reply?.ok){$('status').textContent=copyFor(active).failed;busy=false;for(const key of ['done','decline','cancel'])$(key).disabled=false;}
  // Only the broker's next state may close the panel.
 });
}
setInterval(updateTimer,1000);
