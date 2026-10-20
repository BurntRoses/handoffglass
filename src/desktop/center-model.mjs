/** A deliberately narrow data contract for the desktop control center.
 * Never put bearer tokens, window titles, task text or private paths in this view.
 */
export const STATUS_FIELDS = Object.freeze(['schemaVersion','broker','desktopConnected','lastAgentActivityAt','displays','pendingPolls','handoff','hostActivity','timeline']);
const SAFE_TIMELINE_TYPES = new Set(['started','target_acquired','target_moved','target_lost','target_restored','display_changed','desktop_unavailable','scene_changed','tracking_released','completed','declined','cancelled','expired','superseded']);
export function summarizeDiagnostics(input, now = Date.now()) {
  if (!input || input.schemaVersion !== 1 || input.broker !== 'running') throw new TypeError('Unavailable broker diagnostics');
  const recent = Number.isFinite(input.lastAgentActivityAt) && input.lastAgentActivityAt > 0 && input.lastAgentActivityAt <= now
    ? now - input.lastAgentActivityAt < 120000 : false;
  const session = input.handoff?.status === 'awaiting_user' ? {
    state: 'awaiting_user', mode: input.handoff.mode === 'guide' ? 'guide' : 'handoff',
    expiresIn: Number.isFinite(input.handoff.timeoutAt) ? Math.max(0, Math.ceil((input.handoff.timeoutAt - now) / 1000)) : null
  } : { state: 'idle' };
  const hosts = Array.isArray(input.hostActivity) ? input.hostActivity.slice(0,16)
    .filter(item => item && typeof item.host === 'string' && /^[a-z]+$/.test(item.host) &&
      Number.isFinite(item.lastSeenAt) && item.lastSeenAt <= now && now - item.lastSeenAt < 900000)
    .map(item => ({host:item.host, agoSeconds:Math.floor((now-item.lastSeenAt)/1000),
      calls:Number.isInteger(item.calls) ? Math.min(9999,Math.max(0,item.calls)) : 0,
      lastAction: typeof item.lastAction==='string' && /^(displays|inspect|show|locate|status|wait|events|cancel|scene|context|blueprint)$/.test(item.lastAction)
        ? item.lastAction : 'other', attribution:'config_declared'})) : [];
  return Object.freeze({broker:'running', desktop:input.desktopConnected === true ? 'present' : 'reconnecting',
    agentActivity:recent ? 'recent' : 'not_observed',
    displays:Number.isInteger(input.displays) ? Math.max(0, Math.min(16,input.displays)) : 0,
    session, hosts, timeline:Array.isArray(input.timeline)?input.timeline.slice(-12).filter(x => x && SAFE_TIMELINE_TYPES.has(x.type) && Number.isFinite(x.at) && x.at<=now).map(x=>({type:x.type,agoSeconds:Math.max(0,Math.floor((now-x.at)/1000))})):[], observation: 'authenticated_tool_call_host_label_unverified'});
}
