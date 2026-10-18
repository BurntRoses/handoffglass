/** Opt-in compact MCP tool results. Stable default API remains unchanged. */
function compactSession(session) {
  if (!session) return null;
  const { id, status, mode, timeoutAt, verified, completionSource } = session;
  return { id, status, mode, timeoutAt, verified, completionSource };
}
export function formatToolResult(value, { compact = false } = {}) {
  if (!compact || !value || typeof value !== 'object') return value;
  if ('session' in value) {
    const { session, ...rest } = value;
    const { instruction, ...other } = rest;
    return { session: compactSession(session), ...other };
  }
  if ('displays' in value && Array.isArray(value.displays)) {
    return { displays: value.displays.map(({ id, x, y, width, height }) => ({ id, x, y, width, height })),
      connected: value.connected, headless: value.headless };
  }
  return value;
}
