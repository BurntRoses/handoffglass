import {panelState} from './panel-state.mjs';
import {disclosure} from './disclosure.mjs';
'use strict';
let active=null,busy=false,collapsed=false,manualCollapse=false,stepKey='',clockTimer=null,lastSize='',feedback='';
const $=id=>document.getElementById(id);
const UI={
 'zh-CN':{done:'我已完成',decline:'拒绝',cancel:'结束',pause:'暂停',resume:'继续',collapse:'收起',expand:'展开',retry:'重新定位',fallback:'改用文字提示',sending:'正在发送…',failed:'未能发送，请重试',step:n=>`第 ${n} 步`,total:(n,t)=>`第 ${n} / ${t} 步`,remaining:n=>`${n} 秒后结束`,waiting:'等待你操作',trial:'本地试用',parkedSubmitted:'操作已记录',submitted:'等待会话核实',next:'等待下一步提示',paused:'引导已暂停',reconnecting:'正在恢复连接',lost:'目标位置暂不可用',permission:'控件定位权限需要检查',lostNote:'在原窗口核对目标，或选择一种恢复方式。',pausedNote:'继续后需要回到原会话检查目标。',review:'等待会话接续',reviewNote:'回到原会话说“继续”，Agent 会重新检查目标。',returnToChat:'回到原会话说“继续”，让 Agent 核实结果。',offlineNote:'正在重新连接本地服务，标记已收起。',details:'当前状态',detail:'完成后会检查原应用，再给出下一步。',phase:{thinking:'Agent 正在处理',observing:'正在读取界面',locating:'正在定位目标',presenting:'正在准备引导',verifying:'正在核实结果'}},
 'en-US':{done:'I completed this',decline:'Decline',cancel:'End',pause:'Pause',resume:'Resume',collapse:'Collapse',expand:'Expand',retry:'Locate again',fallback:'Use text guidance',sending:'Sending…',failed:'Could not send. Try again.',step:n=>`Step ${n}`,total:(n,t)=>`Step ${n} of ${t}`,remaining:n=>`Ends in ${n}s`,waiting:'Waiting for you',trial:'Local trial',parkedSubmitted:'Action recorded',submitted:'Awaiting verification',next:'Waiting for the next step',paused:'Guidance paused',reconnecting:'Reconnecting',lost:'Target position unavailable',permission:'Check control lookup permission',lostNote:'Check the target in its original window, or choose a recovery action.',pausedNote:'Resume, then return to your chat to check the target.',review:'Return to your chat',reviewNote:'Say “continue” in your original chat to check the target again.',returnToChat:'Say “continue” in your original chat to verify the result.',offlineNote:'Reconnecting to the local service. Marks are hidden.',details:'Current status',detail:'Your agent will check the original app before presenting the next step.',phase:{thinking:'Agent is working',observing:'Reading the interface',locating:'Locating the target',presenting:'Preparing guidance',verifying:'Checking the result'}}
};
const copy=()=>UI[active?.locale]||UI['zh-CN'];
const card=disclosure($('cardBody'),$('collapse'),{onSize:size});
function size(){
 if(!active)return;
 const height=Math.ceil($('panel').getBoundingClientRect().height),key=`${height}:${collapsed}`;
 if(key===lastSize)return;lastSize=key;window.handoffglass.resize?.({height,compact:collapsed});
}
function updateClock(){
 clearTimeout(clockTimer);clockTimer=null;if(!active)return;
 const c=copy(),state=panelState(active),left=active.timeoutAt-Date.now();
 $('timer').hidden=!Number.isFinite(left)||left>60000;$('timer').textContent=c.remaining(Math.max(0,Math.ceil(left/1000)));
 $('phase').textContent=c.phase[state.key]||c[state.key]||'';
 $('panel').dataset.state=state.tone;$('panel').dataset.working=String(state.working);
 $('phase').title=$('phase').textContent;
 $('elapsed').textContent=active.execution==='parked'?(active.locale==='en-US'?'On desktop':'桌面引导'):(active.locale==='en-US'?'With agent':'会话接续');
 size();
 const delays=[];
 if(Number.isFinite(left)&&left>0)delays.push(left>60000?left-60000:1000);
 if(state.working)delays.push(Math.max(1,30000-(Date.now()-active.agentState.at)));
 if(delays.length)clockTimer=setTimeout(updateClock,Math.min(...delays));
}
function iconLabel(id,label){$(id).setAttribute('aria-label',label);$(id).title=label;}
function render(session){
 if(!session){active=null;busy=false;feedback='';stepKey='';lastSize='';$('panel').dataset.working='false';$('panel').dataset.state='quiet';clearTimeout(clockTimer);clockTimer=null;$('phase').textContent='';$('status').textContent='';return;}
 const nextKey=`${session.id}:${session.step}`;
 if(nextKey!==stepKey){stepKey=nextKey;manualCollapse=false;collapsed=false;busy=false;feedback='';$('cardBody').scrollTop=0;$('stepDetails').open=false;}
 active=session;const c=copy(),waiting=session.status==='awaiting_user',paused=session.status==='paused';
 if(!manualCollapse)collapsed=paused;
 document.documentElement.lang=session.locale||'zh-CN';document.documentElement.dataset.theme=session.theme||'system';
 $('panel').dataset.density=session.density||'normal';$('panel').dataset.compact=String(collapsed);card.set(!collapsed);
 $('step').textContent=collapsed?`${c.step(session.step||1)} · ${session.title}`:session.totalSteps?c.total(session.step||1,session.totalSteps):c.step(session.step||1);
 $('title').textContent=session.title;$('message').textContent=session.message;
 $('message').hidden=['verifying','reconnecting'].includes(session.phase);
 $('stepDetails').hidden=session.phase==='verifying'&&session.execution==='parked';
 $('done').hidden=!waiting;$('decline').hidden=!waiting||session.mode==='guide';$('doneLabel').textContent=c.done;
 iconLabel('pause',paused?c.resume:c.pause);$('pause').dataset.paused=String(paused);iconLabel('collapse',collapsed?c.expand:c.collapse);$('collapse').setAttribute('aria-expanded',String(!collapsed));
 iconLabel('cancel',c.cancel);$('decline').textContent=c.decline;$('retry').textContent=c.retry;$('fallback').textContent=c.fallback;
 const lost=session.phase==='blocked',offline=session.desktopConnection==='reconnecting';
 const reported=session.phase==='verifying'&&session.execution==='parked',review=session.phase==='reconnecting';
 $('note').hidden=!lost&&!paused&&!offline&&!reported&&!review;$('note').dataset.tone=lost||offline?'warning':'info';
 $('note').textContent=offline?c.offlineNote:paused?c.pausedNote:reported?c.returnToChat:review?c.reviewNote:c.lostNote;
 $('recoveryActions').hidden=!lost;$('detailsLabel').textContent=c.details;$('detailText').textContent=session.execution==='parked'?(session.locale==='en-US'?'The guide stays here. Return to the original chat to check the result.':'引导保留在桌面，操作后回到原会话核实。'):c.detail;
 $('execution').hidden=session.execution==='parked'||!session.continuous;
 $('execution').textContent=session.locale==='en-US'?'Leave guide on desktop':'挂起会话';
 for(const id of ['done','decline','cancel','pause','retry','fallback','execution'])$(id).disabled=busy||offline;
 $('status').textContent=busy?c.sending:feedback;$('status').dataset.error=String(Boolean(feedback));
 updateClock();
}
window.handoffglass.onRender(render);
async function send(action,decision=false){
 if(!active||busy)return;const expected={id:active.id,step:active.step};feedback='';busy=true;render(active);$('status').textContent=copy().sending;
 let reply;try{reply=decision?await window.handoffglass.decide(expected.id,action,expected.step):await window.handoffglass.control(expected.id,action,expected.step);}catch{reply={ok:false};}
 if(active?.id!==expected.id||active?.step!==expected.step)return;
 busy=false;feedback=reply?.ok?'':copy().failed;render(active);size();
}
for(const [id,decision] of Object.entries({done:'completed',decline:'declined',cancel:'cancelled'}))$(id).addEventListener('click',()=>void send(decision,true));
$('execution').addEventListener('click',()=>void send('park'));
$('pause').addEventListener('click',()=>void send(active?.status==='paused'?'resume':'pause'));
$('retry').addEventListener('click',()=>void send('retry_target'));
$('fallback').addEventListener('click',()=>void send('text_fallback'));
$('collapse').addEventListener('click',()=>{manualCollapse=true;collapsed=!collapsed;render(active);});

new ResizeObserver(size).observe($('panel'));
window.addEventListener('pagehide',()=>{clearTimeout(clockTimer);card.dispose();});
