#!/usr/bin/env node
/** Stateless MCP adapter: multiple stdio hosts share a single local broker. */
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { BrokerClient } from './runtime.mjs';

const broker = new BrokerClient();
const annotation = z.object({
  x: z.number().finite().min(-100000).max(100000),
  y: z.number().finite().min(-100000).max(100000),
  shape: z.enum(['arrow', 'ring', 'box', 'spotlight']).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  label: z.string().max(64).optional(),
  width: z.number().positive().max(5000).optional(),
  height: z.number().positive().max(5000).optional()
});
const presentation = z.object({
  title: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(1000),
  x: z.number().finite().min(-100000).max(100000).optional(),
  y: z.number().finite().min(-100000).max(100000).optional(),
  shape: z.enum(['arrow', 'ring', 'box', 'spotlight']).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  annotations: z.array(annotation).max(8).optional(),
  timeoutSeconds: z.number().int().min(10).max(3600).optional()
});
const json = object => ({ content: [{ type: 'text', text: JSON.stringify(object) }] });
const safe = fn => async args => {
  try { return json(await fn(args)); }
  catch (error) { return { isError: true, ...json({ error: error.message, code: error.code || 'broker_error' }) }; }
};
function makeServer() {
  const server = new McpServer({ name: 'handoffglass', version: '0.3.0' });
  server.registerTool('screen_displays', {
    title: 'Inspect display geometry',
    description: 'Return connected screen bounds in device-independent pixels (DIP). No screenshots or UI element location.',
    inputSchema: z.object({}), annotations: { readOnlyHint: true }
  }, safe(() => broker.displays()));
  server.registerTool('visual_show', {
    title: 'Show on-screen guidance',
    description: 'Draw up to eight independently grounded targets; never guess positions. Requires x/y global DIP coordinates. The human remains in control.',
    inputSchema: presentation, annotations: { readOnlyHint: false }
  }, safe(args => broker.present('guide', args)));
  server.registerTool('handoff_request', {
    title: 'Request human intervention',
    description: 'Ask the human to finish a step and decide whether to proceed. Coordinates optional. If a different Agent already owns the screen, returns busy; do not retry blindly.',
    inputSchema: presentation, annotations: { readOnlyHint: false }
  }, safe(args => broker.present('handoff', args)));
  server.registerTool('handoff_status', {
    title: 'Read owned handoff state',
    description: 'A completed decision is a user report, not proof that any permission or downstream action succeeded.',
    inputSchema: z.object({ sessionId: z.string().uuid() }), annotations: { readOnlyHint: true }
  }, safe(({ sessionId }) => broker.status(sessionId)));
  server.registerTool('handoff_wait', {
    title: 'Await human response',
    description: 'Wait up to 30 seconds. If pending, poll again; never infer success from no response.',
    inputSchema: z.object({ sessionId: z.string().uuid(), maxWaitSeconds: z.number().min(0).max(30).default(15) }),
    annotations: { readOnlyHint: true }
  }, safe(({ sessionId, maxWaitSeconds }) => broker.wait(sessionId, maxWaitSeconds)));
  server.registerTool('handoff_cancel', {
    title: 'Cancel only your handoff',
    description: 'Cancels a session owned by this MCP connection; cannot dismiss another Agent’s session.',
    inputSchema: z.object({ sessionId: z.string().uuid() }), annotations: { readOnlyHint: false }
  }, safe(({ sessionId }) => broker.cancel(sessionId)));
  return server;
}
serveStdio(makeServer, { onerror: error => console.error('[handoffglass] MCP transport error:', error) });
