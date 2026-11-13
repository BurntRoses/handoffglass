#!/usr/bin/env node
/** Stateless MCP adapter: multiple stdio hosts share a single local broker. */
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { BrokerClient } from './runtime.mjs';
import { formatToolResult } from './output.mjs';
import { VISUAL_STYLES, MOTION_MODES } from './local/preferences.mjs';
import { BLUEPRINT_NAMES } from './local/blueprints.mjs';
import { assessHandoff, GROUNDING_EVIDENCE } from './local/policy.mjs';
import { SHAPES, TONES, TEMPLATE_NAMES, EFFECTS, MASK_STYLES, EXIT_STYLES } from './visual/scene.mjs';
import { PLACEMENTS, DIRECTIONS } from './visual/quick-mark.mjs';
import {fileURLToPath} from 'node:url';
import {realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import { capabilityInstructions } from './capabilities.mjs';
import {INTEGRATION_HOSTS} from './integration-lifecycle.mjs';

const annotation = z.object({
  x: z.number().finite().min(-100000).max(100000),
  y: z.number().finite().min(-100000).max(100000),
  shape: z.enum(SHAPES).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  label: z.string().max(64).optional(),
  direction:z.enum(DIRECTIONS).optional(),
  strokeWidth:z.number().min(1).max(8).optional(),
  lineStyle:z.enum(['solid','dashed']).optional(),
  width: z.number().positive().max(5000).optional(),
  height: z.number().positive().max(5000).optional(),
  id: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,47}$/).optional(),
  tone: z.enum(Object.keys(TONES)).optional(),
  opacity: z.number().min(0).max(1).optional(),
  effect: z.enum(EFFECTS).optional(),
  maskStyle: z.enum(MASK_STYLES).optional(),
  exit: z.enum(EXIT_STYLES).optional(),
  delayMs: z.number().min(0).max(5000).optional(),
  durationMs: z.number().min(200).max(4000).optional()
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
const bounds=z.object({x:z.number().finite().min(-100000).max(100000),y:z.number().finite().min(-100000).max(100000),width:z.number().positive().max(100000),height:z.number().positive().max(100000)});
const observation=z.object({capturedAt:z.number().finite(),layoutSignature:z.string().regex(/^[a-f0-9]{16}$/),provenance:z.enum(['host','native','user'])});
const frame=z.object({width:z.number().positive().max(100000),height:z.number().positive().max(100000),bounds,
  capturedAt:z.number().finite(),layoutSignature:z.string().regex(/^[a-f0-9]{16}$/),provenance:z.enum(['host','native','user'])});
const observedUpdate=z.object({sessionId:z.string().uuid(),expectedRevision:z.number().int().positive(),bounds,frame:frame.optional(),observation:observation.optional(),
  shape:z.enum(SHAPES).optional(),label:z.string().max(64).optional(),color:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()});
const presentation = z.object({
  sessionId: z.string().uuid().optional(),
  mode: z.enum(['guide', 'handoff']).optional(),
  execution:z.enum(['attached','parked']).optional(),
  target: uiTarget.optional(),
  targetRef:z.string().regex(/^target_[0-9a-f-]{36}$/).optional(),
  intent:z.enum(['focus','point','inspect','caution','verify']).optional(),
  completion:z.object({kind:z.enum(['user_report','observed_condition']),condition:z.literal('target_absent').optional()}).optional(),
  sensitive:z.boolean().optional(),purpose:z.enum(['verification','decision','teaching']).optional(),
  retryDeclined:z.boolean().optional().describe('Only true after the user explicitly asks to retry this previously declined step; never use for automatic retries.'),
  scrim:z.boolean().optional(),
  totalSteps:z.number().int().min(1).max(999).optional(),
  taskTimeoutSeconds:z.number().int().min(60).max(86400).optional(),
  followTarget: z.boolean().optional(),
  bounds:bounds.optional(),frame:frame.optional(),observation:observation.optional(),label:z.string().max(64).optional(),
  title: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(1000),
  x: z.number().finite().min(-100000).max(100000).optional(),
  y: z.number().finite().min(-100000).max(100000).optional(),
  shape: z.enum(SHAPES).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  effect: z.enum(EFFECTS).optional(),
  maskStyle: z.enum(MASK_STYLES).optional(),
  exit: z.enum(EXIT_STYLES).optional(),
  delayMs: z.number().min(0).max(5000).optional(),
  durationMs: z.number().min(200).max(4000).optional(),
  annotations: z.array(annotation).max(8).optional(),
  scene: scene.optional(),
  template: z.enum(TEMPLATE_NAMES).optional(),
  timeoutSeconds: z.number().int().min(10).max(3600).optional(),
  visualStyle: z.enum(VISUAL_STYLES).optional(),
  motion: z.enum(MOTION_MODES).optional(),
  requestId: z.string().regex(/^[A-Za-z0-9_.:-]{8,96}$/).optional()
});
const compact = process.env.HANDOFFGLASS_OUTPUT === 'compact';
// Kept short because hosts use server instructions while choosing tools.
export const SERVER_INSTRUCTIONS = capabilityInstructions();
const json = object => {const value=formatToolResult(object,{compact});return {content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value};};
const safe = fn => async args => {
  try { return json(await fn(args)); }
  catch (error) { return { isError: true, ...json({ error: error.message, code: error.code || 'broker_error', ...(error.nextAction?{nextAction:error.nextAction}:{}) }) }; }
};
export function makeServer({broker=new BrokerClient(),env=process.env,server,exitOnUninstall=false}={}) {
  server ??= new McpServer({ name: 'handoffglass', version: '0.23.0' }, { instructions: SERVER_INSTRUCTIONS });
  const legacy=env.HANDOFFGLASS_LEGACY_TOOLS==='1';
  const profile=env.HANDOFFGLASS_TOOL_PROFILE||'full';
  if(!['host','full'].includes(profile))throw new TypeError('HANDOFFGLASS_TOOL_PROFILE must be host or full');
  const host=profile==='host';
  const stepPresentation=host?presentation.omit({target:true,targetRef:true,followTarget:true,scene:true,annotations:true,x:true,y:true})
    .extend({completion:z.object({kind:z.enum(['user_report','observed_condition'])}).optional()}):presentation;
  const legacyNames=new Set(['visual_show','handoff_request','visual_scene_update','handoff_status','handoff_events','handoff_wait','handoff_cancel']);
  const replacements={visual_scene_update:'session_update',handoff_cancel:'session_stop'};
  const register=(name,spec,handler)=>{
    if(host&&['ui_inspect','ui_locate'].includes(name))return;
    // Annotation/session writes affect only our local presentation state.
    // Do not let omitted risk hints classify drawing as file destruction.
    if(['screen_mark','session_start','session_present','visual_show','handoff_request','visual_scene_update','review_changes','session_verify','session_resume','session_control','handoff_cancel'].includes(name))
      spec={...spec,annotations:{destructiveHint:false,openWorldHint:false,...spec.annotations}};
    if(replacements[name])server.registerTool(replacements[name],spec,handler);
    if(!legacyNames.has(name)||legacy)server.registerTool(name,spec,handler);
  };

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
    register('handoff_context', {
      title: 'Local visual preferences',
      description: 'Read user-managed local display preferences. Never contains passwords, screen content or a history of approvals.',
      inputSchema: z.object({}), annotations: { readOnlyHint: true }
    }, safe(() => broker.context()));
    register('handoff_assess', {
      title: 'Local-first handoff preflight',
      description: 'No model inference or desktop access. Choose session_start mode from scenario and grounding evidence; never invent coordinates or approve.',
      inputSchema: z.object({ blueprint: z.enum(BLUEPRINT_NAMES),
        evidence: z.enum(GROUNDING_EVIDENCE).default('none'), locale: z.enum(['zh-CN','en-US']).default('zh-CN') }),
      annotations: { readOnlyHint: true }
    }, safe(args => assessHandoff(args)));
    register('handoff_blueprint', {
      title: 'Local human handoff blueprint',
      description: 'Deterministically plan a common human-controlled step without spending model tokens. No action is executed.',
      inputSchema: z.object({blueprint:z.enum(BLUEPRINT_NAMES),locale:z.enum(['zh-CN','en-US']).optional()}),
      annotations: { readOnlyHint: true }
    }, safe(({blueprint,locale}) => broker.blueprint(blueprint,locale)));
  }
  register('screen_displays', {
    title: 'Inspect display geometry',
    description: 'Return connected screen bounds in device-independent pixels (DIP). No screenshots or UI element location.',
    inputSchema: z.object({}), annotations: { readOnlyHint: true }
  }, safe(() => broker.displays()));
  register('screen_mark', {
    title:'Draw, revise or clear screen marks',
    description:'Draw host-observed bounds once; no native lookup, preflight or wait. bounds={x,y,width,height} is top-left global DIP; with frame it is pixels in that exact image, mapped to frame.bounds global DIP (one display). Reuse authorized host observations; never bypass capture restrictions or guess controls. Decorative marks use placement. Update/clear own id+expectedRevision; fixed marks expire.',
    inputSchema:z.object({
      visualStyle:z.enum(VISUAL_STYLES).optional(),motion:z.enum(MOTION_MODES).optional(),
      action:z.enum(['draw','update','clear']).optional(),id:z.string().uuid().optional(),expectedRevision:z.number().int().positive().optional(),
      shape:z.enum(SHAPES).optional(),placement:z.enum(PLACEMENTS).optional(),direction:z.enum(DIRECTIONS).optional(),
      bounds:bounds.optional(),frame:frame.optional(),observation:observation.optional(),position:z.object({x:z.number().finite(),y:z.number().finite()}).optional(),
      size:z.number().min(24).max(800).optional(),width:z.number().min(24).max(1200).optional(),height:z.number().min(24).max(1200).optional(),
      color:z.string().regex(/^#[a-fA-F0-9]{6}$/).optional(),label:z.string().max(64).optional(),strokeWidth:z.number().min(1).max(8).optional(),lineStyle:z.enum(['solid','dashed']).optional(),
      effect:z.enum(EFFECTS).optional(),exit:z.enum(EXIT_STYLES).optional(),maskStyle:z.enum(MASK_STYLES).optional(),sequence:z.boolean().optional(),
      marks:z.array(z.object({id:z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,47}$/).optional(),shape:z.enum(SHAPES),placement:z.enum(PLACEMENTS).optional(),
        bounds:bounds.optional(),frame:frame.optional(),observation:observation.optional(),position:z.object({x:z.number().finite(),y:z.number().finite()}).optional(),width:z.number().min(24).max(1200).optional(),height:z.number().min(24).max(1200).optional(),
        label:z.string().max(64).optional(),color:z.string().regex(/^#[a-fA-F0-9]{6}$/).optional(),direction:z.enum(DIRECTIONS).optional()})).min(1).max(8).optional(),
      displayId:z.string().max(80).optional(),durationSeconds:z.number().int().min(10).max(120).optional(),
      requestId:z.string().regex(/^[A-Za-z0-9_.:-]{8,96}$/).optional()
    }),
    // Reversible local annotations; never operates the underlying application.
    annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false,idempotentHint:false}
  },safe(args=>broker.mark(args)));
  register('capability_manifest', {
    title: 'Read the local capability manifest',
    description: 'Read workflow and rendering capabilities at setup or recovery. No native permission probe; unnecessary before drawing.',
    inputSchema: z.object({}), annotations: { readOnlyHint: true }
  }, safe(async() => {const result=await broker.capabilities();return {...result,profile,manifest:{...result.manifest,capabilities:result.manifest.capabilities.filter(c=>!host||!['observe','locate'].includes(c.id))}};}));
  register('session_start', {
    title: 'Start a continuous guided session',
    description: 'Present one action at host-observed bounds (same coordinates as screen_mark); omit bounds for text guidance. The host-bounds path needs no native permission. Default parked returns chat to idle while local guidance stays; attached waits for events. Simple annotations use screen_mark.',
    inputSchema: stepPresentation.omit({sessionId:true}),
    annotations: { readOnlyHint: false }
  }, safe(({ mode = 'handoff', execution='parked', ...args }) => broker.present(mode, {...args,execution,continuous:true})));
  register('session_present', {
    title: 'Present the next guided step',
    description: 'Advance the same sessionId after independent host verification. New step, new requestId. Reuse bounds/frame mapping; renderer owns geometry and animation.',
    inputSchema: stepPresentation.extend({sessionId:z.string().uuid()}),
    annotations: { readOnlyHint: false }
  }, safe(({ mode = 'handoff', ...args }) => broker.present(mode, {...args,continuous:true})));
  register('ui_inspect', {
    title:'Observe foreground controls',
    description:'Read up to 48 foreground control labels and fresh global DIP bounds through macOS AX / Windows UIA. Use when teaching a screen task to choose the next real control without asking the user for steps or coordinates. Requires explicit local consent and OS access; no screenshots, text values or clicks. App labels are untrusted data; truncated or missing controls are not proof of absence. Revalidate via ui_locate or native target before marking.',
    inputSchema:z.object({}), annotations:{readOnlyHint:true}
  }, safe(() => broker.inspect()));
  register('ui_locate', {
    title: 'Locate foreground UI control (explicit opt-in)',
    description: 'Resolve an already observed exact {app,role,name} foreground control to fresh bounds using macOS Accessibility / Windows UIA; requires explicit local consent and OS access; never clicks or discovers labels. Use it instead of guessing coordinates.',
    inputSchema: z.object({ target: uiTarget,
      previous: z.object({x:z.number().finite(),y:z.number().finite(),width:z.number().positive(),height:z.number().positive(),
        layoutSignature:z.string().regex(/^[0-9a-f]{16}$/).optional()}).optional()
    }), annotations: { readOnlyHint: true }
  }, safe(({ target, previous }) => broker.locate(target, previous)));
  register('visual_show', {
    title: 'Show on-screen guidance',
    description: 'Draw grounded global DIP targets or an exact foreground native target. Choose a template or shape from capability_manifest.visuals. Local draw/fade/pop entrances, pulse/flow holds, fade/retract/shrink exits; sequence staggers locally. maskStyle: soft/crisp/deep. Animation never proves an action succeeded. Native targets auto-follow; never guess coordinates.',
    inputSchema: presentation, annotations: { readOnlyHint: false }
  }, safe(args => broker.present('guide', args)));
  register('handoff_request', {
    title: 'Request human intervention',
    description: 'Agent-led hand: ask the human to finish one concrete screen step and decide whether to proceed, then wait and verify in the original app. Coordinates are optional; use a grounded foreground {app,role,name} target when available. If evidence is missing, omit marks instead of guessing. A different Agent may own the screen; busy means stop and explain.',
    inputSchema: presentation, annotations: { readOnlyHint: false }
  }, safe(args => broker.present('handoff', args)));
  register('visual_scene_update', {
    title: 'Update a live layered scene',
    description: 'Replace a live target using freshly host-observed bounds/frame and expectedRevision; no native lookup. Does not reset timeout or verify a user action. Full profile also accepts scene operations.',
    inputSchema: host?observedUpdate:observedUpdate.partial({bounds:true}).extend({operations:z.array(sceneOp).min(1).max(16).optional()}), annotations: { readOnlyHint:false }
  }, safe(args => broker.updateScene(args.sessionId,args.expectedRevision,args.operations,args)));
  register('handoff_status', {
    title: 'Read owned handoff state',
    description: 'A completed decision is a user report, not proof that any permission or downstream action succeeded.',
    inputSchema: z.object({ sessionId: z.string().uuid() }), annotations: { readOnlyHint: true }
  }, safe(({ sessionId }) => broker.status(sessionId)));
  register('handoff_events', {
    title: 'Read incremental handoff events and recovery guidance',
    description: 'Bounded local event cursor for an owned handoff: target moved/lost/recovered, scene changed, user decision. Returns the next safe action; never proves a downstream operation succeeded.',
    inputSchema: z.object({sessionId:z.string().uuid(),after:z.number().int().nonnegative().default(0),
      limit:z.number().int().min(1).max(32).default(20)}),
    annotations: {readOnlyHint:true}
  }, safe(({sessionId,after,limit})=>broker.events(sessionId,after,limit)));
  register('handoff_wait', {
    title: 'Await human response',
    description: 'Continue the handoff loop for up to 30 seconds. Pending means keep waiting or poll again; completed is only the user report, so inspect the original app before the next step. Lost target means re-locate; declined, cancelled, expired or busy means stop.',
    inputSchema: z.object({ sessionId: z.string().uuid(), maxWaitSeconds: z.number().min(0).max(30).default(15) }),
    annotations: { readOnlyHint: true }
  }, safe(({ sessionId, maxWaitSeconds }) => broker.wait(sessionId, maxWaitSeconds)));
  register('session_wait', {
    title: 'Wait for the next session event',
    description: 'Long-wait for the same owned session. Return incremental events and the next safe action; use the cursor to avoid duplicate model work.',
    inputSchema: z.object({ sessionId: z.string().uuid(), cursor: z.number().int().nonnegative().default(0), maxWaitSeconds: z.number().min(0).max(30).default(20) }),
    annotations: { readOnlyHint: true }
  }, safe(({sessionId,cursor,maxWaitSeconds})=>broker.wait(sessionId,maxWaitSeconds,{continuous:true,cursor})));
  const digestSummary=z.object({summary:z.string().max(240),hash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
  register('review_changes',{
    title:'Present a read-only change review',
    description:'Show file/config/setting/permission/external changes as summaries and SHA256 only; never send file contents or credentials. Wait for human review, then independently check before continuing. Decline/timeout means stop. Replay is read-only; no operation is executed.',
    inputSchema:z.object({action:z.enum(['present','status','wait']).default('present'),id:z.string().uuid().optional(),retryDeclined:z.boolean().optional().describe('Only true after the user explicitly asks to review the declined changes again.'),timeoutMs:z.number().int().min(0).max(30000).optional(),timeoutSeconds:z.number().int().min(10).max(600).optional(),changes:z.array(z.object({kind:z.enum(['file','config','setting','permission','external']),risk:z.enum(['low','medium','high','irreversible']),summary:z.string().max(240),before:digestSummary,after:digestSummary}).strict()).min(1).max(24).optional()}),
    annotations:{readOnlyHint:false}
  },safe(args=>broker.review(args)));
  register('session_verify', {
    title: 'Record independent verification',
    description: 'Record the Agent’s independent check after a user report or observed-condition step. result:verified + finish:true ends the workflow; inconclusive keeps a coordinate-free pending check; otherwise retain ownership and present the next step with the same sessionId. A user report alone is insufficient.',
    inputSchema: z.object({ sessionId: z.string().uuid(), result:z.enum(['verified','mismatch','inconclusive']).optional(), verified: z.boolean().optional(), finish:z.boolean().default(false),expectedStep:z.number().int().min(1).optional() }),
    annotations: { readOnlyHint: false }
  }, safe(({ sessionId, result,verified, finish,expectedStep }) => {if(result===undefined&&verified===undefined)throw Error('Provide result: verified, mismatch or inconclusive');if(result!==undefined&&verified!==undefined)throw Error('Choose result or legacy verified');return broker.verify(sessionId,result??verified,finish,expectedStep);}));
  register('session_resume', {
    title:'Recover an interrupted session',description:'Reclaim with the saved sessionId and resumeToken after MCP or Broker restart. Rotates the token and clears marks; preserves pending verification and pause. Observe the app before continuing; never replay a user action.',
    inputSchema:z.object({sessionId:z.string().uuid(),resumeToken:z.string().regex(/^[0-9a-f]{64}$/)}),annotations:{readOnlyHint:false}
  },safe(({sessionId,resumeToken})=>broker.resume(sessionId,resumeToken)));
  register('session_control', {
    title:'Pause, recover or report a session phase',description:'Pause/resume on user request, request target recovery, or report an actual observation/verification phase. Progress is factual; do not invent model thinking.',
    inputSchema:z.object({sessionId:z.string().uuid(),action:z.enum(['pause','resume','retry_target','text_fallback','progress','park','attach']),phase:z.enum(['observing','locating','presenting','verifying','thinking','idle']).optional(),expectedStep:z.number().int().min(1).optional()}),annotations:{readOnlyHint:false}
  },safe(({sessionId,action,phase,expectedStep})=>broker.control(sessionId,action,phase,expectedStep)));
  register('connection_status', {
    title: 'Read host connection status',
    description: 'Return local broker, desktop, continuous-session and user enablement status without changing host configuration.',
    inputSchema: z.object({host:z.enum(INTEGRATION_HOSTS).optional()}), annotations: { readOnlyHint: true }
  }, safe(({host}) => broker.connection(host)));
  register('permission_status', {
    title: 'Read local permission status',
    description: 'Return whether HandoffGlass is enabled and whether native control lookup has user consent. Includes a status-only native permission probe without reading controls. Does not grant permission.',
    inputSchema: z.object({}), annotations: { readOnlyHint: true }
  }, safe(() => broker.permissions()));
  register('integration_status', {
    title: 'Inspect an integration lifecycle',
    description: 'Read installation, enablement and owned cleanup state for a supported local host. Metadata only; does not prove host loading or model acceptance.',
    inputSchema: z.object({ host: z.enum(INTEGRATION_HOSTS).default('codex') }), annotations: { readOnlyHint: true }
  }, safe(({ host }) => broker.integrationStatus(host)));
  register('integration_install',{
    title:'Prepare or install a local host integration',
    description:'Preview by default. confirm:true applies an explicit user connection request. Installs only HandoffGlass files and its own host reference; preserves unrelated settings and never grants tool approval, Hook trust or OS access. Reload and first call remain host steps.',
    inputSchema:z.object({host:z.enum(INTEGRATION_HOSTS),confirm:z.boolean().default(false)}),annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}
  },safe(({host,confirm})=>broker.installIntegration(host,confirm)));
  register('integration_set_enabled', {
    title:'Enable or pause HandoffGlass',
    description:'Enable or pause only on user request. Omit host for the global switch, which immediately cancels guidance. With host, change only that managed integration and reload the host. WorkBuddy enablement remains in WorkBuddy. Never grants tool or OS permissions.',
    inputSchema:z.object({enabled:z.boolean(),host:z.enum(INTEGRATION_HOSTS).optional()}),annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}
  },safe(({enabled,host})=>broker.setEnabled(enabled,host)));
  register('integration_uninstall',{
    title:'Uninstall owned HandoffGlass files',description:'Preview the complete owned removal by default. confirm:true applies an explicit user uninstall request, removes host integrations and schedules app/runtime removal after exit. Report retained files and resultPath; scheduled is not completed.',
    inputSchema:z.object({confirm:z.boolean().default(false)}),annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:false}
  },safe(async({confirm})=>{const result=await broker.uninstall(confirm);if(exitOnUninstall&&result.result?.scheduled)setTimeout(()=>process.exit(0),250);return result;}));
  register('integration_cleanup', {
    title: 'Remove an owned local integration',
    description: 'Prepare a cleanup plan by default. Set confirm=true only when the user explicitly asked to remove the named integration; only recorded, unchanged local files are removed/restored. Edited or unrecorded content is retained. WorkBuddy host removal remains manual; the desktop app is not deleted.',
    inputSchema: z.object({ host: z.enum(INTEGRATION_HOSTS), confirm: z.boolean().default(false) }), annotations: { readOnlyHint: false,destructiveHint:true,openWorldHint:false }
  }, safe(({ host, confirm }) => broker.cleanupIntegration(host, confirm)));
  register('handoff_cancel', {
    title: 'Cancel only your handoff',
    description: 'Cancels a session owned by this MCP connection; cannot dismiss another Agent’s session.',
    inputSchema: z.object({ sessionId: z.string().uuid() }), annotations: { readOnlyHint: false }
  }, safe(({ sessionId }) => broker.cancel(sessionId)));
  return server;
}
/** One authoritative catalog for MCP and native hosts; constructing it starts no process. */
export function toolCatalog(broker,env={HANDOFFGLASS_TOOL_PROFILE:'host'}){
  const tools=new Map();
  makeServer({broker,env,server:{registerTool:(name,spec,handler)=>tools.set(name,{name,...spec,handler}),registerPrompt(){}}});
  return tools;
}
const isMain=()=>{try{return !!process.argv[1]&&realpathSync(resolve(process.argv[1]))===fileURLToPath(import.meta.url);}catch{return false;}};
if(isMain())
  serveStdio(()=>makeServer({exitOnUninstall:true}), {onerror:error=>console.error('[handoffglass] MCP transport error:',error)});
