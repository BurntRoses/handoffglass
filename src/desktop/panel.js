import {panelState} from './panel-state.mjs';
import {disclosure} from './disclosure.mjs';
'use strict';
let active=null,busy=false,collapsed=false,manualCollapse=false,stepKey='',clockTimer=null,lastSize='',feedback='';
let peeking=false;
const $=id=>document.getElementById(id);
const UI={
 'zh-CN':{inconclusive:'暂时无法核验',inconclusiveNote:'目前无法确认原应用的结果。回到原会话补充可核实的信息，不必重复刚才的操作。',done:'我已完成',decline:'拒绝',cancel:'结束',pause:'暂停',resume:'继续',collapse:'收起',expand:'展开',retry:'重新定位',fallback:'改用文字提示',sending:'正在发送…',failed:'未能发送，请重试',step:n=>`第 ${n} 步`,total:(n,t)=>`第 ${n} / ${t} 步`,remaining:n=>`${n} 秒后结束`,waiting:'等待你操作',trial:'本地试用',parkedSubmitted:'操作已记录',submitted:'等待会话核实',next:'等待下一步提示',paused:'引导已暂停',reconnecting:'正在恢复连接',lost:'目标位置暂不可用',permission:'控件定位权限需要检查',lostNote:'在原窗口核对目标，或选择一种恢复方式。',pausedNote:'继续后需要回到原会话检查目标。',review:'等待会话接续',reviewNote:'回到原会话说“继续”，Agent 会重新检查目标。',returnToChat:'回到原会话说“继续”，让 Agent 核实结果。',offlineNote:'正在重新连接本地服务，标记已收起。',details:'当前状态',detail:'完成后会检查原应用，再给出下一步。',phase:{thinking:'Agent 正在处理',observing:'正在读取界面',locating:'正在定位目标',presenting:'正在准备引导',verifying:'正在核实结果'}},
 'en-US':{inconclusive:'Unable to verify',inconclusiveNote:'The original application result could not be checked. Return to your chat with independent evidence; do not repeat the action.',done:'I completed this',decline:'Decline',cancel:'End',pause:'Pause',resume:'Resume',collapse:'Collapse',expand:'Expand',retry:'Locate again',fallback:'Use text guidance',sending:'Sending…',failed:'Could not send. Try again.',step:n=>`Step ${n}`,total:(n,t)=>`Step ${n} of ${t}`,remaining:n=>`Ends in ${n}s`,waiting:'Waiting for you',trial:'Local trial',parkedSubmitted:'Action recorded',submitted:'Awaiting verification',next:'Waiting for the next step',paused:'Guidance paused',reconnecting:'Reconnecting',lost:'Target position unavailable',permission:'Check control lookup permission',lostNote:'Check the target in its original window, or choose a recovery action.',pausedNote:'Resume, then return to your chat to check the target.',review:'Return to your chat',reviewNote:'Say “continue” in your original chat to check the target again.',returnToChat:'Say “continue” in your original chat to verify the result.',offlineNote:'Reconnecting to the local service. Marks are hidden.',details:'Current status',detail:'Your agent will check the original app before presenting the next step.',phase:{thinking:'Agent is working',observing:'Reading the interface',locating:'Locating the target',presenting:'Preparing guidance',verifying:'Checking the result'}}
};
Object.assign(UI['zh-CN'],{
 mismatch:'结果与预期不符',mismatchNote:'回到原会话查看核验结果，等新的步骤提示。',
 attachedReceipt:'操作已记录。Agent 将检查原应用的结果。',
 observed:'检测到目标变化',observedNote:'需要检查原应用，确认界面变化是否符合预期。',
 locationRequested:'已请求重新定位',textRequested:'已请求文字引导',fallback:'文字引导',
 correctionRequested:'已报告位置错误',correctTarget:'指错位置了',peek:'按住查看原界面',
 verifiedReceipt:'已核实',verifiedPrevious:detail=>`上一步已核实 · ${detail}`,scrollToTarget:'先滚动到目标',
 recoverHere:'正在等待原会话提供更新后的步骤。',
 recoverInChat:'回到原会话说“继续”，获取更新后的步骤。',
 expiredTarget:'标记已过期。可重新定位，或改用文字提示。',
 screenshot:'已根据截图标出位置。',
 screenshotFallback:'当前界面无法直接读取，已根据截图标出位置。',
 displayChanged:'显示布局已变化，可用新的位置重新标记。',
 permissionNote:'查看当前应用的定位权限，或改用文字提示。'
});
Object.assign(UI['en-US'],{
 mismatch:'Result differs from expected',mismatchNote:'Check the verification result in your original chat and wait for an updated step.',
 attachedReceipt:'Action recorded. The agent will check the result in the original app.',
 observed:'Target change detected',observedNote:'Check the original app to confirm what changed.',
 locationRequested:'New location requested',textRequested:'Text guidance requested',fallback:'Text guidance',
 correctionRequested:'Wrong location reported',correctTarget:'Wrong location',peek:'Hold to see the original screen',
 verifiedReceipt:'Verified',verifiedPrevious:detail=>`Previous step verified · ${detail}`,scrollToTarget:'Scroll to the target',
 recoverHere:'Waiting for an updated step from your chat.',
 recoverInChat:'Say “continue” in your original chat for the updated step.',
 expiredTarget:'The mark expired. Locate it again or use text guidance.',
 screenshot:'Marked using the screenshot.',
 screenshotFallback:'Direct access to this interface is unavailable. The mark is based on the screenshot.',
 displayChanged:'The display layout changed. Locate the target again to update its mark.',
 permissionNote:'Check control lookup access or use text guidance.'
});
const copy=()=>UI[active?.locale]||UI['zh-CN'];
const card=disclosure($('cardBody'),$('collapse'),{onSize:size});
function size(){
 if(!active)return;
 const height=Math.ceil($('panel').getBoundingClientRect().height),key=`${height}:${collapsed}`;
 if(key===lastSize)return;lastSize=key;window.handoffglass.resize?.({height,compact:collapsed});
}
function updateClock(){
 clearTimeout(clockTimer);clockTimer=null;if(!active)return;
 const now=Date.now(),c=copy(),state=panelState(active,now),left=active.timeoutAt-now;
 const finalized=active.status==='completed';
 const summary=active.verification?.summary;
 const previous=active.previousVerification;
 const remaining=previous?.at+8000-now;
 const receipt=summary||(previous?.summary&&remaining>0?c.verifiedPrevious(previous.summary):'');
 $('verificationReceipt').hidden=!receipt;$('verificationReceipt').textContent=receipt;
 $('timer').hidden=finalized||!Number.isFinite(left)||left>60000;$('timer').textContent=c.remaining(Math.max(0,Math.ceil(left/1000)));
 const observed=active.phase==='verifying'&&active.completionSource==='native_observation'&&['submitted','parkedSubmitted'].includes(state.key);
 $('phase').textContent=observed?c.observed:summary?c.verifiedReceipt:c.phase[state.key]||c[state.key]||'';
 $('panel').dataset.state=state.tone;$('panel').dataset.working=String(state.working);
 $('phase').title=$('phase').textContent;
 size();
 const delays=[];
 if(Number.isFinite(left)&&left>0)delays.push(left>60000?left-60000:1000);
 if(state.working)delays.push(Math.max(1,30000-(Date.now()-active.agentState.at)));
 if(remaining>0)delays.push(remaining);
 if(delays.length)clockTimer=setTimeout(updateClock,Math.min(...delays));
}
function iconLabel(id,label){$(id).setAttribute('aria-label',label);$(id).title=label;}
function setPeek(next){
 if(next===peeking||next&&($('peek').hidden||$('peek').disabled))return;
 peeking=next;$('peek').dataset.held=String(peeking);
 window.handoffglass.peek(stepKey,peeking);
}
function render(session){
 if(!session){setPeek(false);active=null;busy=false;feedback='';stepKey='';lastSize='';$('panel').dataset.working='false';$('panel').dataset.state='quiet';clearTimeout(clockTimer);clockTimer=null;$('phase').textContent='';$('status').textContent='';$('verificationReceipt').hidden=true;return;}
 const nextKey=`${session.id}:${session.step}`;
 if(nextKey!==stepKey||active?.recoveryRequired&&session.status==='awaiting_user'){
   manualCollapse=false;collapsed=false;$('stepBody').scrollTop=0;$('stepDetails').open=false;
 }
 if(nextKey!==stepKey){setPeek(false);stepKey=nextKey;busy=false;feedback='';}
 active=session;const c=copy(),waiting=session.status==='awaiting_user',paused=session.status==='paused';
 const blocked=session.phase==='blocked',recovering=blocked&&session.recoveryRequired;
 const offline=session.desktopConnection==='reconnecting',reported=session.phase==='verifying',review=session.phase==='reconnecting';
 const inconclusive=session.verification?.result==='inconclusive',mismatch=session.verification?.result==='mismatch';
 const returnToChat=session.execution==='parked'||session.agentWaiting===false;
 const canRecover=blocked&&waiting&&session.continuous;
 const finalized=session.status==='completed';
 const hasMarks=waiting&&session.annotations?.length>0&&!offline;
 const scrollMark=session.annotations?.find(mark=>mark.scrollDirection);
 $('peek').hidden=!hasMarks;
 if(!hasMarks)setPeek(false);
 iconLabel('peek',c.peek);
 $('correctTarget').hidden=!hasMarks||!session.continuous||!!scrollMark;
 $('correctTarget').textContent=c.correctTarget;
 if(!manualCollapse)collapsed=paused;
 document.documentElement.lang=session.locale||'zh-CN';document.documentElement.dataset.theme=session.theme||'system';
 $('panel').dataset.density=session.density||'normal';$('panel').dataset.compact=String(collapsed);$('panel').dataset.receipt=String(finalized);
 card.set(!collapsed&&!finalized,{instant:finalized});
 $('step').textContent=collapsed&&!finalized?`${c.step(session.step||1)} · ${session.title}`:session.totalSteps?c.total(session.step||1,session.totalSteps):c.step(session.step||1);
 for(const id of ['pause','collapse','cancel'])$(id).hidden=finalized;
 $('title').textContent=session.title;$('message').textContent=session.message;
 $('message').hidden=reported||review||mismatch||recovering;
 const protectedStep=session.purpose==='verification';
 $('protectedNote').hidden=!protectedStep||!waiting;
 $('protectedNote').textContent=session.locale==='en-US'?'Complete this step in the original app.':'请在原应用中亲自完成。';
 $('stepDetails').hidden=reported||blocked||review||mismatch;
 $('done').hidden=!waiting;$('decline').hidden=!waiting||session.mode==='guide';$('doneLabel').textContent=c.done;
 $('done').classList.toggle('action-primary',!canRecover);
 $('done').classList.toggle('secondary',canRecover);
 $('decisionActions').hidden=$('done').hidden&&$('decline').hidden;
 iconLabel('pause',paused?c.resume:c.pause);$('pause').dataset.paused=String(paused);iconLabel('collapse',collapsed?c.expand:c.collapse);$('collapse').setAttribute('aria-expanded',String(!collapsed));
 iconLabel('cancel',c.cancel);$('decline').textContent=c.decline;$('retry').textContent=c.retry;$('fallback').textContent=c.fallback;
 const reason=session.targetTracking?.reason;
 let note='';
 if(offline)note=c.offlineNote;
 else if(paused)note=c.pausedNote;
 else if(recovering)note=returnToChat?c.recoverInChat:c.recoverHere;
 else if(blocked)note=reason==='stale_observation'?c.expiredTarget:
   reason==='display_layout_changed'?c.displayChanged:
   ['consent_required','permission_denied'].includes(reason)?c.permissionNote:c.lostNote;
 else if(inconclusive)note=c.inconclusiveNote;
 else if(mismatch)note=c.mismatchNote;
 else if(reported)note=session.completionSource==='native_observation'?
   (returnToChat?c.returnToChat:c.observedNote):(returnToChat?c.returnToChat:c.attachedReceipt);
 else if(review)note=c.reviewNote;
 else if(hasMarks){
   const screenshotNote=session.observationMethod==='screenshot_fallback'?c.screenshotFallback:session.observationMethod==='screenshot'?c.screenshot:'';
   note=[screenshotNote,scrollMark?.label].filter(Boolean).join(' ');
 }
 $('note').hidden=!note;$('note').dataset.tone=(blocked&&!recovering)||offline||inconclusive||mismatch?'warning':'info';
 $('note').textContent=note;
 $('recoveryActions').hidden=!canRecover;
 $('detailsLabel').textContent=c.details;$('detailText').textContent=session.execution==='parked'?(session.locale==='en-US'?'The guide stays here. Return to the original chat to check the result.':'引导保留在桌面，操作后回到原会话核实。'):c.detail;
 $('execution').hidden=session.execution==='parked'||!session.continuous;
 $('execution').textContent=session.locale==='en-US'?'Leave guide on desktop':'挂起会话';
 for(const id of ['done','decline','cancel','pause','retry','fallback','execution','peek','correctTarget'])$(id).disabled=busy||offline;
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
$('correctTarget').addEventListener('click',()=>void send('correct_target'));
$('fallback').addEventListener('click',()=>void send('text_fallback'));
$('collapse').addEventListener('click',()=>{manualCollapse=true;collapsed=!collapsed;render(active);});
const peek=$('peek');
peek.addEventListener('pointerdown',event=>{
 if(event.button!==0)return;
 peek.setPointerCapture(event.pointerId);setPeek(true);
});
for(const event of ['pointerup','pointercancel','lostpointercapture','blur'])peek.addEventListener(event,()=>setPeek(false));
for(const event of ['keydown','keyup'])peek.addEventListener(event,key=>{
 if(![' ','Enter'].includes(key.key))return;
 key.preventDefault();setPeek(event==='keydown');
});
window.addEventListener('blur',()=>setPeek(false));

new ResizeObserver(size).observe($('panel'));
window.addEventListener('pagehide',()=>{setPeek(false);clearTimeout(clockTimer);card.dispose();});
