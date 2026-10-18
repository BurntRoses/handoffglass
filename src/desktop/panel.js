'use strict';
let active = null;
let busy = false;
const $ = id => document.getElementById(id);
const UI = Object.freeze({
  'zh-CN': {remaining:n=>`会话剩余 ${n} 秒 · 仅用户主动确认后反馈 Agent`,guide:'操作说明',handoff:'需要人工决定',done:'我已完成',ack:'知道了',decline:'拒绝',cancel:'取消引导',sending:'正在提交…',note:'请先核对原始窗口中的权限和操作内容。本工具不会替你点击或授权。'},
  'en-US': {remaining:n=>`${n}s remaining · Only your decision is sent to the agent`,guide:'Guidance',handoff:'Human decision needed',done:'I completed this',ack:'Understood',decline:'Decline',cancel:'Cancel',sending:'Sending…',note:'Review permissions in the original application. HandoffGlass never clicks or authorizes on your behalf.'}
});
function updateTimer() {
  if (!active) return;
  const left = Math.max(0, Math.ceil((active.timeoutAt - Date.now()) / 1000));
  $('timer').textContent = UI[active.locale] ? UI[active.locale].remaining(left) : UI['zh-CN'].remaining(left);
}
function render(session) {
  active = session;
  busy = false;
  for (const id of ['done', 'decline', 'cancel']) $(id).disabled = false;
  if (!session) return;
  const copy=UI[session.locale] || UI['zh-CN'];
  document.documentElement.lang=session.locale || 'zh-CN';
  document.querySelector('.panel')?.setAttribute('data-density',session.density==='compact'?'compact':'normal');
  $('decline').textContent=copy.decline;
  $('cancel').textContent=copy.cancel;
  $('note').textContent=copy.note;
  $('title').textContent = session.title;
  $('message').textContent = session.message;
  $('tag').textContent = session.mode === 'guide' ? 'GUIDANCE' : 'HANDOFF';
  $('status').textContent = session.mode === 'guide' ? copy.guide : copy.handoff;
  $('done').textContent = session.mode === 'guide' ? copy.ack : copy.done;
  $('decline').hidden = session.mode === 'guide';
  updateTimer();
}
window.handoffglass.onRender(render);
for (const [id, decision] of Object.entries({ done: 'completed', decline: 'declined', cancel: 'cancelled' })) {
  $(id).addEventListener('click', async () => {
    if (!active || busy) return;
    const requestedId = active.id;
    busy = true;
    for (const key of ['done', 'decline', 'cancel']) $(key).disabled = true;
    $('status').textContent = (UI[active.locale] || UI['zh-CN']).sending;
    let reply;
    try { reply = await window.handoffglass.decide(requestedId, decision); }
    catch { reply = { ok: false, error: '本地通信失败，请重试' }; }
    if (active?.id !== requestedId) return; // A newer handoff owns the panel.
    if (!reply?.ok) {
      $('status').textContent = reply?.error || '提交失败';
      busy = false;
      for (const key of ['done', 'decline', 'cancel']) $(key).disabled = false;
    }
    // Success is followed by a state-driven hide; never fake completed locally.
  });
}
setInterval(updateTimer, 1000);
