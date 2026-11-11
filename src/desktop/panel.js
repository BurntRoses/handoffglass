'use strict';
let active=null,busy=false,collapsed=false,manualCollapse=false,stepKey='';
const $=id=>document.getElementById(id);
const UI={
 'zh-CN':{done:'我已完成',ack:'我已完成',decline:'拒绝',cancel:'结束',pause:'暂停',resume:'继续',collapse:'收起',expand:'展开',retry:'重新定位',fallback:'改用文字提示',sending:'正在发送…',failed:'未能发送，请重试',step:n=>`第 ${n} 步`,total:(n,t)=>`第 ${n} / ${t} 步`,remaining:n=>`${n} 秒后结束`,elapsed:n=>`已等待 ${n} 秒`,waiting:'等待你操作',submitted:'操作已提交，等待原会话继续',next:'等待下一步提示',paused:'引导已暂停',reconnecting:'正在恢复连接',notWaiting:'应用暂未接续，请回到原会话',lost:'目标位置暂不可用',permission:'控件定位权限需要检查',lostNote:'在原窗口核对目标，或选择一种恢复方式。',pausedNote:'继续后会重新检查目标位置。',offlineNote:'正在重新连接本地服务，标记已收起。',details:'当前状态',detail:'完成后会检查原应用，再给出下一步。',phase:{thinking:'Agent 正在处理',observing:'正在读取界面',locating:'正在定位目标',presenting:'正在准备引导',verifying:'正在核实结果'}},
 'en-US':{done:'I completed this',ack:'I completed this',decline:'Decline',cancel:'End',pause:'Pause',resume:'Resume',collapse:'Collapse',expand:'Expand',retry:'Locate again',fallback:'Use text guidance',sending:'Sending…',failed:'Could not send. Try again.',step:n=>`Step ${n}`,total:(n,t)=>`Step ${n} of ${t}`,remaining:n=>`Ends in ${n}s`,elapsed:n=>`Waiting ${n}s`,waiting:'Waiting for you',submitted:'Submitted · waiting for your agent',next:'Waiting for the next step',paused:'Guidance paused',reconnecting:'Reconnecting',notWaiting:'Agent has not resumed · return to the chat',lost:'Target position unavailable',permission:'Check control lookup permission',lostNote:'Check the target in its original window, or choose a recovery action.',pausedNote:'Resuming will check the target again.',offlineNote:'Reconnecting to the local service. Marks are hidden.',details:'Current status',detail:'Your agent will check the original app before presenting the next step.',phase:{thinking:'Agent is working',observing:'Reading the interface',locating:'Locating the target',presenting:'Preparing guidance',verifying:'Checking the result'}}
};
const copy=()=>UI[active?.locale]||UI['zh-CN'];
function phaseLabel(){
 const c=copy(),s=active;if(!s)return '';
 if(s.demo&&s.status!=='paused'&&s.phase!=='blocked')return s.locale==='en-US'?'Local trial':'本地试用';
 if(s.desktopConnection==='reconnecting')return c.reconnecting;
 if(s.status==='paused')return c.paused;
 if(s.phase==='blocked')return ['consent_required','permission_denied'].includes(s.targetTracking?.reason)?c.permission:c.lost;
 if(s.phase==='reconnecting')return c.reconnecting;
 const reported=s.agentState,age=Date.now()-(reported?.at||0);
 if(age<30000&&c.phase[reported?.phase])return c.phase[reported.phase];
 if(s.phase==='verifying')return c.submitted;
 if(s.phase==='next_step')return c.next;
 if(s.agentWaiting===false&&age>30000)return c.notWaiting;
 return c.waiting;
}
function size(){window.handoffglass.resize?.({height:Math.ceil($('panel').getBoundingClientRect().height),compact:collapsed});}
function updateClock(){
 if(!active)return;const c=copy(),waiting=active.status!=='awaiting_user';
 const seconds=Math.max(0,Math.ceil((active.timeoutAt-Date.now())/1000));
 $('timer').hidden=!Number.isFinite(seconds)||seconds>60;$('timer').textContent=c.remaining(seconds);
 $('elapsed').textContent=waiting?c.elapsed(Math.max(0,Math.floor((Date.now()-(active.updatedAt||Date.now()))/1000))):'';
 $('phase').textContent=phaseLabel();size();
}
function render(session){
 if(!session)return;const nextKey=`${session.id}:${session.step}`;
 if(nextKey!==stepKey){stepKey=nextKey;manualCollapse=false;collapsed=false;busy=false;}
 active=session;const c=copy(),waiting=session.status==='awaiting_user',paused=session.status==='paused';
 if(!manualCollapse)collapsed=!waiting;
 document.documentElement.lang=session.locale||'zh-CN';document.documentElement.dataset.theme=session.theme||'system';
 $('panel').dataset.density=session.density||'normal';$('panel').dataset.compact=String(collapsed);
 $('step').textContent=collapsed?`${c.step(session.step||1)} · ${session.title}`:session.totalSteps?c.total(session.step||1,session.totalSteps):c.step(session.step||1);
 $('title').textContent=session.title;$('message').textContent=session.message;
 $('done').hidden=!waiting;$('decline').hidden=!waiting||session.mode==='guide';$('doneLabel').textContent=c.done;
 $('pause').textContent=paused?c.resume:c.pause;$('collapse').textContent=collapsed?c.expand:c.collapse;$('collapse').setAttribute('aria-expanded',String(!collapsed));
 $('cancel').textContent=c.cancel;$('decline').textContent=c.decline;$('retry').textContent=c.retry;$('fallback').textContent=c.fallback;
 const lost=session.phase==='blocked',offline=session.desktopConnection==='reconnecting';
 $('note').hidden=!lost&&!paused&&!offline;$('note').textContent=offline?c.offlineNote:paused?c.pausedNote:c.lostNote;
 $('recoveryActions').hidden=!lost;$('detailsLabel').textContent=c.details;$('detailText').textContent=c.detail;
 for(const id of ['done','decline','cancel','pause','retry','fallback'])$(id).disabled=busy||offline;
 if(!busy)$('status').textContent='';updateClock();
}
window.handoffglass.onRender(render);
async function send(action,decision=false){
 if(!active||busy)return;const expected={id:active.id,step:active.step};busy=true;render(active);$('status').textContent=copy().sending;
 let reply;try{reply=decision?await window.handoffglass.decide(expected.id,action,expected.step):await window.handoffglass.control(expected.id,action,expected.step);}catch{reply={ok:false};}
 if(active?.id!==expected.id||active?.step!==expected.step)return;
 busy=false;render(active);if(!reply?.ok)$('status').textContent=copy().failed;size();
}
for(const [id,decision] of Object.entries({done:'completed',decline:'declined',cancel:'cancelled'}))$(id).addEventListener('click',()=>void send(decision,true));
$('pause').addEventListener('click',()=>void send(active?.status==='paused'?'resume':'pause'));
$('retry').addEventListener('click',()=>void send('retry_target'));
$('fallback').addEventListener('click',()=>void send('text_fallback'));
$('collapse').addEventListener('click',()=>{manualCollapse=true;collapsed=!collapsed;render(active);});
$('stepDetails').addEventListener('toggle',size);
new ResizeObserver(size).observe($('panel'));
setInterval(updateClock,1000);
