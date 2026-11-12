/** Machine-readable continuation survives compact output. */
export function continuationFor(session) {
  if (!session) return 'check_session';
  if(session.execution==='parked' && !['completed','declined','cancelled','expired','superseded'].includes(session.status))return 'yield_to_user';
  if (session.nextAction) return session.nextAction;
  if (session.status === 'completed') return 'verify_in_app';
  if (['declined','cancelled','expired','superseded'].includes(session.status)) return 'stop';
  if (session.targetTracking?.status === 'desktop_unavailable') return 'check_desktop_connection';
  if (['lost','layout_changed'].includes(session.targetTracking?.status)) {
    return ['consent_required','permission_denied'].includes(session.targetTracking.reason) ? 'check_accessibility_permission' : 'reobserve_target';
  }
  return session.mode === 'guide' ? 'observe_app' : 'wait_for_user';
}
function compactSession(session) {
  if (!session) return null;
  const { id, status, mode, execution, phase, nextAction, continuous, step, totalSteps, epoch, completion, taskTimeoutAt, stepTimeoutAt, timeoutAt, verified, completionSource, sceneRevision, targetTracking } = session;
  return { id, status, mode, ...(execution?{execution}:{}), ...(continuous?{continuous,step,totalSteps,epoch,completion,taskTimeoutAt,stepTimeoutAt}:{}), ...(phase ? { phase } : {}), ...(nextAction ? { nextAction } : {}), timeoutAt, verified, completionSource, ...(sceneRevision ? { sceneRevision } : {}), ...(targetTracking ? { targetStatus: targetTracking.status } : {}) };
}
export function formatToolResult(value, { compact = false } = {}) {
  if (!value || typeof value !== 'object') return value;
  if ('session' in value) {
    const { session, ...rest } = value;
    const nextAction = continuationFor(session);
    if (!compact) return { ...value, nextAction };
    const { instruction, ...other } = rest;
    return { session: compactSession(session), ...other, nextAction };
  }
  if (!compact) return value;
  if ('displays' in value && Array.isArray(value.displays)) {
    return { displays: value.displays.map(({ id, x, y, width, height,primary,scaleFactor }) => ({ id, x, y, width, height,primary,scaleFactor })),
      ...(value.layoutSignature?{layoutSignature:value.layoutSignature,coordinateSystem:value.coordinateSystem}:{}),connected: value.connected, headless: value.headless };
  }
  return value;
}
