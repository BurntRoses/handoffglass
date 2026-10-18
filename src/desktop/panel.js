'use strict';
let active = null;
let busy = false;
const $ = id => document.getElementById(id);
function updateTimer() {
  if (!active) return;
  const left = Math.max(0, Math.ceil((active.timeoutAt - Date.now()) / 1000));
  $('timer').textContent = `会话剩余 ${Math.floor(left / 60)} 分 ${String(left % 60).padStart(2, '0')} 秒 · 仅用户主动确认后反馈 Agent`;
}
function render(session) {
  active = session;
  busy = false;
  for (const id of ['done', 'decline', 'cancel']) $(id).disabled = false;
  if (!session) return;
  $('title').textContent = session.title;
  $('message').textContent = session.message;
  $('tag').textContent = session.mode === 'guide' ? 'GUIDANCE' : 'HANDOFF';
  $('status').textContent = session.mode === 'guide' ? '操作说明' : '需要人工决定';
  $('done').textContent = session.mode === 'guide' ? '知道了' : '我已完成';
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
    $('status').textContent = '正在提交…';
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
