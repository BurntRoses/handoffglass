// This trial only checks HandoffGlass cards and controls. It never verifies an
// external application or claims the host has connected.
export function startDesktopTrial(manager, preferences, displays = []) {
  const owner = 'desktop-trial';
  const english = preferences.locale === 'en-US';
  const copy = english ? [
    ['Find the prompt', 'This is a local display trial. The mark is a sample position. Select “I completed this” to continue.'],
    ['Try the controls', 'You can pause, resume or collapse this card. When ready, select “I completed this”.'],
    ['Finish the trial', 'The three cards use the same session. This trial checks display controls; host connection and control lookup are checked separately.']
  ] : [
    ['看看提示位置', '这次只试用本地显示，标记是示例位置。点击“我已完成”继续。'],
    ['试试控制条', '可以暂停、继续或收起卡片。准备好后，点击“我已完成”。'],
    ['结束这次试用', '三张卡片属于同一次引导。本次只检查显示与控制；宿主连接和控件定位需分别验证。']
  ];
  const display = displays.find(d => String(d.id) === String(preferences.displayId)) || displays[0];
  const request = step => ({
    mode: 'handoff', continuous: true, title: copy[step - 1][0], message: copy[step - 1][1],
    totalSteps: 3, timeoutSeconds: 300, locale: preferences.locale,
    theme: preferences.theme, visualStyle: preferences.visualStyle, motion: preferences.motion,
    ...(step === 1 && display ? {annotations:[{x:display.x+display.width/2,y:display.y+display.height/2,shape:'ring',label:english?'Sample position':'示例位置'}]} : {})
  });
  const session = manager.show(request(1), owner);
  if (session.error) return {session, dispose() {}};
  let queued = false, disposed = false;
  const dispose = () => { disposed = true; manager.off('change', changed); };
  const changed = state => {
    if (state.id !== session.id) return;
    if (['completed', 'declined', 'cancelled', 'expired', 'superseded'].includes(state.status)) { dispose(); return; }
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (disposed) return;
      let current = manager.getOwned(session.id, owner);
      if (current?.status === 'user_action_reported') {
        // The only observed action is acknowledgement of our own local card.
        manager.verify(session.id, owner, true, current.step === 3);
        if (current.step === 3) return;
        manager.present(session.id, request(current.step + 1), owner);
      } else if (current?.status === 'observing' && current.recoveryRequired) {
        manager.present(session.id, request(current.step), owner);
      }
    });
  };
  manager.on('change', changed);
  return {session, dispose};
}
