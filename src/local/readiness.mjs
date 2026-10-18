/** Pure installation readiness assessment: facts ≠ GUI acceptance. */
export function assessReadiness({
  nodeMajor, platform, coreAvailable, electronAvailable = false,
  desktopSession = false, brokerConnected = false,
  accessibilityOptIn = false, accessibilityReady = false
} = {}) {
  if (!Number.isInteger(nodeMajor) || typeof platform !== 'string' || typeof coreAvailable !== 'boolean')
    throw new TypeError('Missing trusted environment facts');
  const osSupported = ['darwin', 'win32'].includes(platform);
  const checks = [
    { id:'node', status:nodeMajor >= 22 ? 'pass' : 'fail', info:'Node.js 22+ for source distribution' },
    { id:'mcp_dependencies', status:coreAvailable ? 'pass' : 'fail', info:'Official MCP SDK and zod are installed' },
    { id:'desktop_platform', status:osSupported ? 'pass' : 'limited', info:osSupported ? 'Desktop overlay platform supported by design' : 'Linux GUI overlay and Wayland remain unverified' },
    { id:'electron', status:electronAvailable ? 'pass' : 'optional', info:'Electron needed only for local desktop UI' },
    { id:'graphics_session', status:desktopSession ? 'pass' : 'manual', info:'A real desktop login session is required for visual QA' },
    { id:'broker', status:brokerConnected ? 'pass' : 'stopped', info:'Broker may be started on demand; stopped is not a failure' },
    { id:'accessibility', status:!accessibilityOptIn ? 'disabled' : accessibilityReady ? 'pass' : 'manual', info:'Read-only native UI location is opt-in and requires OS permission' }
  ];
  return {
    schemaVersion:1,
    coreReady:nodeMajor >= 22 && coreAvailable,
    desktopCandidate:nodeMajor >= 22 && coreAvailable && osSupported && electronAvailable && desktopSession,
    desktopVerified:false,
    // This tool cannot test click-through, security prompts, fullscreen, DPI, or cross-app decisions.
    desktopAcceptance:'physical_GUI_test_required',
    modelCalls:0,
    checks
  };
}
