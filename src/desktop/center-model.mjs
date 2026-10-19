/** A deliberately narrow data contract for the desktop control center.
 * Never put bearer tokens, window titles, task text or private paths in this view.
 */
export const STATUS_FIELDS = Object.freeze(['schemaVersion','broker','desktopConnected','lastAgentActivityAt','displays','pendingPolls','handoff']);
export function summarizeDiagnostics(input, now = Date.now()) {
  if (!input || input.schemaVersion !== 1 || input.broker !== 'running') throw new TypeError('Unavailable broker diagnostics');
  const recent = Number.isFinite(input.lastAgentActivityAt) && input.lastAgentActivityAt > 0 && input.lastAgentActivityAt <= now
    ? now - input.lastAgentActivityAt < 120000 : false;
  const session = input.handoff?.status === 'awaiting_user' ? {
    state: 'awaiting_user', mode: input.handoff.mode === 'guide' ? 'guide' : 'handoff',
    expiresIn: Number.isFinite(input.handoff.timeoutAt) ? Math.max(0, Math.ceil((input.handoff.timeoutAt - now) / 1000)) : null
  } : { state: 'idle' };
  return Object.freeze({broker:'running', desktop:input.desktopConnected === true ? 'present' : 'reconnecting',
    agentActivity:recent ? 'recent' : 'not_observed',
    displays:Number.isInteger(input.displays) ? Math.max(0, Math.min(16,input.displays)) : 0,
    session, observation: 'agent_activity_not_host_registration'});
}
