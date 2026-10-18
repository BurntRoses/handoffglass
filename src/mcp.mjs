#!/usr/bin/env node
/** Stateless MCP adapter: multiple stdio hosts share a single local broker. */
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { BrokerClient } from './runtime.mjs';
import { formatToolResult } from './output.mjs';
import { VISUAL_STYLES, MOTION_MODES } from './local/preferences.mjs';
import { BLUEPRINT_NAMES } from './local/blueprints.mjs';
import { SHAPES, TONES, TEMPLATE_NAMES } from './visual/scene.mjs';

const broker = new BrokerClient();
const annotation = z.object({
  x: z.number().finite().min(-100000).max(100000),
  y: z.number().finite().min(-100000).max(100000),
  shape: z.enum(SHAPES).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  label: z.string().max(64).optional(),
  width: z.number().positive().max(5000).optional(),
  height: z.number().positive().max(5000).optional(),
  id: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,47}$/).optional(),
  tone: z.enum(Object.keys(TONES)).optional(),
  opacity: z.number().min(0).max(1).optional()
});
const layer = z.object({
  id: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,47}$/),
  zIndex: z.number().int().min(-100).max(100).optional(),
  visible: z.boolean().optional(), opacity: z.number().min(0).max(1).optional(),
  annotations: z.array(annotation).max(24).default([])
});
const scene = z.object({ version: z.literal(1), layers: z.array(layer).max(12) });
const sceneOp = z.discriminatedUnion('op', [
  z.object({ op: z.literal('upsert_layer'), layer }),
  z.object({ op: z.literal('remove_layer'), layerId: z.string() }),
  z.object({ op: z.literal('set_layer'), layerId: z.string(), visible: z.boolean().optional(),
    opacity: z.number().min(0).max(1).optional(), zIndex: z.number().int().min(-100).max(100).optional() }),
  z.object({ op: z.literal('upsert_annotation'), layerId: z.string(), annotation }),
  z.object({ op: z.literal('remove_annotation'), layerId: z.string(), annotationId: z.string() })
]);
const uiTarget = z.object({ app: z.string().trim().min(1).max(128), role: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(256) });
const presentation = z.object({
  target: uiTarget.optional(),
  title: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(1000),
  x: z.number().finite().min(-100000).max(100000).optional(),
  y: z.number().finite().min(-100000).max(100000).optional(),
  shape: z.enum(SHAPES).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  annotations: z.array(annotation).max(8).optional(),
  scene: scene.optional(),
  template: z.enum(TEMPLATE_NAMES).optional(),
  timeoutSeconds: z.number().int().min(10).max(3600).optional(),
  visualStyle: z.enum(VISUAL_STYLES).optional(),
  motion: z.enum(MOTION_MODES).optional(),
  requestId: z.string().regex(/^[A-Za-z0-9_.:-]{8,96}$/).optional()
});
const compact = process.env.HANDOFFGLASS_OUTPUT === 'compact';
const json = object => ({ content: [{ type: 'text', text: JSON.stringify(formatToolResult(object, { compact })) }] });
const safe = fn => async args => {
  try { return json(await fn(args)); }
  catch (error) { return { isError: true, ...json({ error: error.message, code: error.code || 'broker_error' }) }; }
};
function makeServer() {
  const server = new McpServer({ name: 'handoffglass', version: '0.6.0' });
  server.registerPrompt('assist-with-ui-step', {
    title: 'Help with a desktop step',
    description: 'Plan a safe human-guided step in an existing task; use the HandoffGlass tools when appropriate.',
    argsSchema: z.object({ task: z.string().trim().min(1).max(300) })
  }, ({ task }) => ({
    messages: [{ role: 'user', content: { type: 'text', text:
      `Assist with this task: ${task}\nWhen automated action is unreliable or requires my informed decision, use HandoffGlass. Do not invent screen coordinates. Explain the action, allow refusal, and independently verify the result after I report completion. Do not ask me to reveal secrets.` } }]
  }));
  // Extras are opt-in: keep the default model tool schema small.
  if (process.env.HANDOFFGLASS_EXTRAS === '1') {
    server.registerTool('handoff_context', {
      title: 'Local visual preferences',
      description: 'Read user-managed local display preferences. Never contains passwords, screen content or a history of approvals.',
      inputSchema: z.object({}), annotations: { readOnlyHint: true }
    }, safe(() => broker.context()));
    server.registerTool('handoff_blueprint', {
      title: 'Local human handoff blueprint',
      description: 'Deterministically plan a common human-controlled step without spending model tokens. No action is executed.',
      inputSchema: z.object({blueprint:z.enum(BLUEPRINT_NAMES),locale:z.enum(['zh-CN','en-US']).optional()}),
      annotations: { readOnlyHint: true }
    }, safe(({blueprint,locale}) => broker.blueprint(blueprint,locale)));
  }
  server.registerTool('screen_displays', {
    title: 'Inspect display geometry',
    description: 'Return connected screen bounds in device-independent pixels (DIP). No screenshots or UI element location.',
    inputSchema: z.object({}), annotations: { readOnlyHint: true }
  }, safe(() => broker.displays()));
  server.registerTool('ui_locate', {
    title: 'Locate foreground UI control (explicit opt-in)',
    description: 'Read-only exact-match macOS Accessibility / Windows UIA targeting, requires HANDOFFGLASS_ENABLE_ACCESSIBILITY=1, foreground app and granted OS access; never clicks.',
    inputSchema: z.object({ target: uiTarget }), annotations: { readOnlyHint: true }
  }, safe(({ target }) => broker.locate(target)));
  server.registerTool('visual_show', {
    title: 'Show on-screen guidance',
    description: 'Draw grounded global DIP targets or exact foreground {app,role,name} target (with explicit accessibility opt-in), optionally with template focus|point|inspect|caution|sequence|verify or an explicit layered scene v1. Never guess coordinates.',
    inputSchema: presentation, annotations: { readOnlyHint: false }
  }, safe(args => broker.present('guide', args)));
  server.registerTool('handoff_request', {
    title: 'Request human intervention',
    description: 'Ask the human to finish a step and decide whether to proceed. Set requestId to prevent duplicate requests on retry. Coordinates optional, or use a foreground {app,role,name} target with opt-in Accessibility. If a different Agent already owns the screen, returns busy; do not retry blindly.',
    inputSchema: presentation, annotations: { readOnlyHint: false }
  }, safe(args => broker.present('handoff', args)));
  server.registerTool('visual_scene_update', {
    title: 'Update a live layered scene',
    description: 'Atomically edit layers/marks with optimistic scene revision and per-Agent ownership. Does not reset timeout. Only sessions initially created with scene/template.',
    inputSchema: z.object({sessionId:z.string().uuid(), expectedRevision:z.number().int().min(1),
      operations:z.array(sceneOp).min(1).max(16)}), annotations: { readOnlyHint:false }
  }, safe(({sessionId,expectedRevision,operations}) => broker.updateScene(sessionId,expectedRevision,operations)));
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
