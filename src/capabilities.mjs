/**
 * Small, model-facing capability manifest. Keep this intentionally stable and
 * short: the host should learn the workflow once during MCP initialization,
 * while the broker owns geometry, retries and permission state locally.
 */
import { VISUAL_CAPABILITIES } from './visual/catalog.mjs';
export const CAPABILITY_MANIFEST = Object.freeze({
  schemaVersion: 1,
  version: 7,
  visuals: VISUAL_CAPABILITIES,
  workflow: Object.freeze(['host_observe', 'present', 'wait', 'host_verify']),
  responsibilities: {host:['authorized observation','target semantics','independent verification'],plugin:['DIP mapping','rendering','animation','local events','owned lifecycle'],nativeLookup:'optional full profile; never a prerequisite for rendering'},
  lifecycle: Object.freeze(['integration_status', 'integration_cleanup', 'integration_set_enabled', 'integration_uninstall', 'permission_status']),
  hosts: Object.freeze([
    { id: 'codex', transport: 'local stdio', setup: 'native plugin (MCP + Skills; optional reviewed Hooks); standalone config.toml + Skill is an alternative', cleanup: 'integration_cleanup' },
    { id: 'workbuddy', transport: 'local stdio connector', setup: 'one MCP server + Skill; trust and enable in WorkBuddy', cleanup: 'integration_cleanup' }
  ]),
  target:{coordinates:'global DIP; bounds top-left; frame pixels map to one display',evidence:'bounds require observation, or frame with capturedAt/layoutSignature/provenance',maxAgeMs:30000,layoutSignature:'Reuse host-supplied layoutSignature or screen_displays metadata; never invent it',provenance:['host','native','user'],missing:'coordinate-free session_start'},
  layers:{guidance:'positions and human-controlled steps',review:'read-only summaries, hashes and trail',verification:['verified','mismatch','inconclusive'],independentSwitches:true},
  capabilities: Object.freeze([
    {id:'review',tool:'review_changes',phase:'review',when:'Human reviews changes before continuation.',requires:['summaries_and_hashes'],returns:'owned read-only review; respect decline/timeout'},
    {id:'mark',tool:'screen_mark',phase:'draw',when:'Render existing host-observed bounds once, or decorative placement. No native lookup, preflight or wait.',requires:['enabled'],returns:'id, revision, expiry; update/clear with expectedRevision'},
    { id:'start',tool:'session_start',phase:'present',when:'Start one workflow.',requires:['enabled'],returns:'session id and nextAction' },
    {id:'resume',tool:'session_resume',phase:'recover',when:'MCP or Broker restarted; saved recovery token available.',requires:['sessionId','resumeToken'],returns:'rotated token; observe before presenting'},
    {id:'control',tool:'session_control',phase:'recover',when:'User pauses/resumes or an actual observation phase begins.',requires:['sessionId'],returns:'session state'},
    { id:'stop',tool:'session_stop',phase:'finish',when:'Cancel the owned workflow.',requires:['sessionId'],returns:'cancelled session' },
    { id: 'observe', tool: 'ui_inspect', phase: 'observe', when: 'Optional full-profile native observation, with explicit consent; host observation is preferred.', requires: ['enabled','accessibility'], returns: 'bounded controls' },
    { id: 'locate', tool: 'ui_locate', phase: 'observe', when: 'Optional full-profile native target following.', requires: ['enabled', 'accessibility'], returns: 'fresh global_DIP bounds and targetRef' },
    { id: 'present', tool: 'session_present', phase: 'present', when: 'Show one grounded step or human decision.', requires: ['enabled'], returns: 'session id and nextAction' },
    { id: 'wait', tool: 'session_wait', phase: 'wait', when: 'Wait for meaningful events in the same session; carry nextCursor.', requires: ['enabled', 'continuous'], returns: 'events and cursor' },
    { id: 'update_scene', tool: 'session_update', phase: 'present', when: 'Patch an existing layered scene.', requires: ['enabled', 'sceneRevision'], returns: 'new sceneRevision' },
    { id: 'verify', tool: 'session_verify', phase: 'verify', when: 'User report or observed-condition step; inspect original app first.', requires: ['independent_check'], returns: 'verified | mismatch | inconclusive' },
    { id: 'connection', tool: 'connection_status', phase: 'recover', when: 'Desktop or host may be unavailable.', requires: [], returns: 'broker and desktop status' },
    { id: 'permission', tool: 'permission_status', phase: 'recover', when: 'Native lookup needs consent.', requires: [], returns: 'local consent and status-only OS/helper probe' },
    { id: 'lifecycle_status', tool: 'integration_status', phase: 'manage', when: 'User asks whether an integration is installed.', requires: [], returns: 'owned integration state' },
    { id:'enablement',tool:'integration_set_enabled',phase:'manage',when:'User asks to pause or re-enable guidance.',requires:['explicit_user_request'],returns:'enabled + nextAction' },
    { id: 'lifecycle_cleanup', tool: 'integration_cleanup', phase: 'manage', when: 'User explicitly asks to remove an integration.', requires: ['explicit_user_request'], returns: 'dry-run plan or applied cleanup' },
    { id:'uninstall',tool:'integration_uninstall',phase:'manage',when:'User explicitly asks to remove the app and its integrations.',requires:['explicit_user_request'],returns:'owned-file preview or scheduled external cleanup and result path' }
  ]),
  quickstart: [
    {tool:'screen_mark',args:{shape:'scribble',placement:'left',label:'查看这里'},note:'Explicit drawing, no observation or wait. Save id/revision for update or clear.'},
    {tool:'session_start',args:{title:'打开设置',message:'点击已标出的设置按钮。',requestId:'unique-step-1'},note:'Coordinate-free example. To add bounds supply capturedAt, layoutSignature and provenance in observation or frame from fresh authorized evidence.'},
    {tool:'session_wait',args:{sessionId:'00000000-0000-4000-8000-000000000001',cursor:0,maxWaitSeconds:20},note:'Use the returned session.id and carry nextCursor into subsequent waits.'},
    {tool:'session_verify',args:{sessionId:'00000000-0000-4000-8000-000000000001',result:'verified',finish:false},note:'Set result from an independent check; finish:true only after the final successful step.'},
    {tool:'session_present',args:{sessionId:'00000000-0000-4000-8000-000000000001',title:'选择项目',message:'选择要打开的项目。',requestId:'unique-step-2'},note:'Keep the same session.id; use a new requestId for each step.'}
  ],
  recovery: {observation_required:{action:'use_coordinate_free_guidance_or_supply_host_evidence'},stale_observation:{action:'reobserve_target'},layout_changed:{action:'reobserve_display_and_target'},disabled_by_user:{action:'stop',tool:'integration_set_enabled',condition:'only if user asks to re-enable'},continuous_disabled:{action:'stop'},consent_required:{action:'open_app_permission_settings'},permission_denied:{action:'open_system_accessibility_settings'},target_not_found:{action:'reobserve_target'},busy:{action:'stop'},verification_due:{action:'verify_in_original_app'},invalid_cursor:{action:'resume_from_nextCursor'},unmanaged:{action:'preserve_and_explain'}},
  transport: {desktop:'local SSE',agent:'cursor long wait',durability:'private minimal checkpoint; restart requires session_resume and fresh observation',hostWakeup:'requires an active session_wait; cannot resume an idle model'},
  invariants: [
    'Never guess coordinates or click on behalf of the user.',
    'A user completion report is not verification.',
    'Reuse the session cursor and requestId while waiting; do not create duplicate handoffs.',
    'Only wake the model for a meaningful event or a required decision.',
    'Cleanup defaults to a dry-run; apply it only after the user explicitly requests removal.'
  ]
});

export function capabilityInstructions() {
  return "HandoffGlass draws; host observes and verifies. Bounds require observation (capturedAt, layoutSignature, provenance), or frame with these fields; max age 30s. Missing evidence: coordinate-free session_start. Decoration: screen_mark(placement) once; no preflight/wait. Tasks: session_start(parked)→yield; attach→host check→session_verify→session_present. Keep id/token/cursor/revision. Never guess controls, bypass protection, click or approve; never ask the user to name a tool. Stop on refusal/disable/busy.";
}
