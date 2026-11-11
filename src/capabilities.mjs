/**
 * Small, model-facing capability manifest. Keep this intentionally stable and
 * short: the host should learn the workflow once during MCP initialization,
 * while the broker owns geometry, retries and permission state locally.
 */
import { VISUAL_CAPABILITIES } from './visual/catalog.mjs';
export const CAPABILITY_MANIFEST = Object.freeze({
  schemaVersion: 1,
  version: 5,
  visuals: VISUAL_CAPABILITIES,
  workflow: Object.freeze(['observe', 'present', 'wait', 'verify']),
  lifecycle: Object.freeze(['integration_status', 'integration_cleanup', 'integration_set_enabled', 'integration_uninstall', 'permission_status']),
  hosts: Object.freeze([
    { id: 'codex', transport: 'local stdio', setup: 'native plugin (MCP + Skills + reviewed Hooks), or standalone config.toml + Skill; choose one', cleanup: 'integration_cleanup' },
    { id: 'workbuddy', transport: 'local stdio connector', setup: 'one MCP server + Skill; trust and enable in WorkBuddy', cleanup: 'integration_cleanup' }
  ]),
  capabilities: Object.freeze([
    {id:'mark',tool:'screen_mark',phase:'draw',when:'Explicit simple screen drawing; call once, without inspection or waiting.',requires:['enabled'],returns:'visible mark, automatic expiry'},
    { id:'start',tool:'session_start',phase:'present',when:'Start one workflow.',requires:['enabled'],returns:'session id and nextAction' },
    {id:'resume',tool:'session_resume',phase:'recover',when:'MCP or Broker restarted; saved recovery token available.',requires:['sessionId','resumeToken'],returns:'rotated token; observe before presenting'},
    {id:'control',tool:'session_control',phase:'recover',when:'User pauses/resumes or an actual observation phase begins.',requires:['sessionId'],returns:'session state'},
    { id:'stop',tool:'session_stop',phase:'finish',when:'Cancel the owned workflow.',requires:['sessionId'],returns:'cancelled session' },
    { id: 'observe', tool: 'ui_inspect', phase: 'observe', when: 'Foreground app or target changed.', requires: ['enabled','accessibility'], returns: 'bounded controls' },
    { id: 'locate', tool: 'ui_locate', phase: 'observe', when: 'Revalidate one exact observed control.', requires: ['enabled', 'accessibility'], returns: 'fresh global_DIP bounds and targetRef' },
    { id: 'present', tool: 'session_present', phase: 'present', when: 'Show one grounded step or human decision.', requires: ['enabled'], returns: 'session id and nextAction' },
    { id: 'wait', tool: 'session_wait', phase: 'wait', when: 'Wait for meaningful events in the same session; carry nextCursor.', requires: ['enabled', 'continuous'], returns: 'events and cursor' },
    { id: 'update_scene', tool: 'session_update', phase: 'present', when: 'Patch an existing layered scene.', requires: ['enabled', 'sceneRevision'], returns: 'new sceneRevision' },
    { id: 'verify', tool: 'session_verify', phase: 'verify', when: 'User report or observed-condition step; inspect original app first.', requires: ['independent_check'], returns: 'verified boolean' },
    { id: 'connection', tool: 'connection_status', phase: 'recover', when: 'Desktop or host may be unavailable.', requires: [], returns: 'broker and desktop status' },
    { id: 'permission', tool: 'permission_status', phase: 'recover', when: 'Native lookup needs consent.', requires: [], returns: 'local consent and status-only OS/helper probe' },
    { id: 'lifecycle_status', tool: 'integration_status', phase: 'manage', when: 'User asks whether an integration is installed.', requires: [], returns: 'owned integration state' },
    { id:'enablement',tool:'integration_set_enabled',phase:'manage',when:'User asks to pause or re-enable guidance.',requires:['explicit_user_request'],returns:'enabled + nextAction' },
    { id: 'lifecycle_cleanup', tool: 'integration_cleanup', phase: 'manage', when: 'User explicitly asks to remove an integration.', requires: ['explicit_user_request'], returns: 'dry-run plan or applied cleanup' },
    { id:'uninstall',tool:'integration_uninstall',phase:'manage',when:'User explicitly asks to remove the app and its integrations.',requires:['explicit_user_request'],returns:'owned-file preview or scheduled external cleanup and result path' }
  ]),
  quickstart: [
    {tool:'session_start',args:{title:'打开设置',message:'点击已标出的设置按钮。',target:{app:'Example',role:'button',name:'设置'},requestId:'unique-step-1'},note:'Replace the target with exact observed labels; omit target when evidence is unavailable.'},
    {tool:'session_wait',args:{sessionId:'00000000-0000-4000-8000-000000000001',cursor:0,maxWaitSeconds:20},note:'Use the returned session.id and carry nextCursor into subsequent waits.'},
    {tool:'session_verify',args:{sessionId:'00000000-0000-4000-8000-000000000001',verified:true,finish:false},note:'Set verified from an independent check; finish:true only after the final successful step.'},
    {tool:'session_present',args:{sessionId:'00000000-0000-4000-8000-000000000001',title:'选择项目',message:'选择要打开的项目。',requestId:'unique-step-2'},note:'Keep the same session.id; use a new requestId for each step.'}
  ],
  recovery: {disabled_by_user:{action:'stop',tool:'integration_set_enabled',condition:'only if user asks to re-enable'},continuous_disabled:{action:'stop'},consent_required:{action:'open_app_permission_settings'},permission_denied:{action:'open_system_accessibility_settings'},target_not_found:{action:'reobserve_target'},busy:{action:'stop'},verification_due:{action:'verify_in_original_app'},invalid_cursor:{action:'resume_from_nextCursor'},unmanaged:{action:'preserve_and_explain'}},
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
  return "HandoffGlass is the agent's hand. Simple drawing: screen_mark once; no inspect/wait. Tasks: observe → session_start → session_wait(cursor) → inspect → session_verify → session_present. Use execution:parked to keep local guidance and yield the chat; attach on return. Put one action in the card; never ask the user to name a tool. Never guess controls/click/approve. Save id/resumeToken/cursor; resume then observe. Verify user reports. Stop on refusal/disable/busy. Removal: integration_cleanup/uninstall.";
}
