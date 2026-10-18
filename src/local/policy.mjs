/**
 * Deterministic preflight for an Agent's next desktop step.
 * This is a pure function: no screenshots, no memory writes, no model calls,
 * no side effects and, crucially, no inferred pixel positions.
 *
 * `evidence` describes a prior observation, not a claim of permission to act.
 */
import { BLUEPRINT_NAMES, compileBlueprint } from './blueprints.mjs';

export const GROUNDING_EVIDENCE = Object.freeze([
  'none', 'global_dip', 'accessibility', 'ambiguous', 'stale', 'offscreen'
]);
const BAD_EVIDENCE = new Set(['ambiguous', 'stale', 'offscreen']);
const SAFE_EVIDENCE = new Set(['global_dip', 'accessibility']);
const VERIFICATION = 'independent_check_required';

const copy = Object.freeze({
  'zh-CN': {
    manual: '当前没有可靠的屏幕坐标。应请求用户在原应用中自行操作，不得猜测按钮位置。',
    invalid: '先重新定位目标或让用户自行找到控件，不得基于过期、越界或歧义结果绘制标注。',
    ready: '可使用有来源的坐标绘制标注。操作后必须独立核实原应用的结果。',
    decision: '敏感操作必须由用户自己决定，用户报告完成不代表任务已验证成功。'
  },
  'en-US': {
    manual: 'No reliable screen coordinates. Ask the human to act in the original app; do not guess a button location.',
    invalid: 'Re-locate the element or use coordinate-free handoff; never draw from stale, offscreen or ambiguous evidence.',
    ready: 'Grounded coordinates are available. Verify the outcome independently in the original application.',
    decision: 'A sensitive decision belongs to the human. A completion report does not prove downstream success.'
  }
});
const TEMPLATES = Object.freeze({
  authorization: 'caution', authentication: 'focus', file_import: 'inspect',
  system_settings: 'caution', destructive_action: 'caution', general: 'point'
});

/** Returns a bounded, no-model plan, not an executable permission or click. */
export function assessHandoff({ blueprint, evidence = 'none', locale = 'zh-CN' } = {}) {
  if (!BLUEPRINT_NAMES.includes(blueprint)) throw new TypeError('Unknown blueprint');
  if (!GROUNDING_EVIDENCE.includes(evidence)) throw new TypeError('Unknown grounding evidence');
  const recipe = compileBlueprint(blueprint, { locale });
  const grounded = SAFE_EVIDENCE.has(evidence);
  const invalid = BAD_EVIDENCE.has(evidence);
  const sensitive = recipe.risk !== 'normal';
  const mode = sensitive || !grounded ? 'handoff' : 'guide';
  const wording = copy[locale];
  return {
    schemaVersion: 1,
    blueprint,
    risk: recipe.risk,
    evidence,
    grounding: grounded ? 'grounded' : invalid ? 'unreliable' : 'not_supplied',
    nextTool: mode === 'handoff' ? 'handoff_request' : 'visual_show',
    coordinateFree: !grounded,
    template: grounded ? TEMPLATES[blueprint] : null,
    userDecides: sensitive,
    humanControlsOriginalApplication: true,
    neverAutoApprove: true,
    verification: VERIFICATION,
    reportIsNotVerification: true,
    reason: invalid ? wording.invalid : !grounded ? wording.manual : wording.ready,
    ...(sensitive ? { sensitiveActionNote: wording.decision } : {}),
    steps: recipe.steps,
    localModelCalls: 0
  };
}
