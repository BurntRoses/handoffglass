/** Deliberately sparse, shareable diagnostic facts. No task, host, path or token. */
const TEST_CODES = Object.freeze(['not_run','passed','timeout','missing_tools','protocol_mismatch','launch_failed','process_exited','handshake_failed','already_running','test_unavailable']);
export function makeSupportReport({appVersion,platform,diagnostics,localTest}={}) {
  const code=TEST_CODES.includes(localTest?.code)?localTest.code:'not_run';
  const platforms=['darwin','win32','linux'].includes(platform)?platform:'unknown';
  const broker=diagnostics?.broker==='running'?'running':'unavailable';
  const desktop=diagnostics?.desktop==='present'?'present':'reconnecting';
  const activity=diagnostics?.agentActivity==='recent'?'recent':'not_observed';
  const version=/^\d+\.\d+\.\d+$/.test(appVersion||'')?appVersion:'unknown';
  const screens=Number.isInteger(diagnostics?.displays)&&diagnostics.displays>=0?Math.min(16,diagnostics.displays):0;
  return Object.freeze({product:'HandoffGlass',version,platform:platforms,
    observation:'local_only_not_host_registration',broker,desktop,
    mcpActivity:activity,displayCount:screens,mcpSelfTest:code,
    desktopAcceptance:'not_measured'});
}
