/** Deterministic local copy and task plans. No model or network call; never approves an action. */
const BP = Object.freeze({
  authorization: { risk: 'sensitive', kind: 'handoff', zh: ['查看所请求的权限及访问范围', '自主决定允许或拒绝', '返回原任务并验证授权是否生效'], en: ['Review requested permissions and scope', 'Decide independently whether to allow or deny', 'Return and independently verify the authorization'] },
  authentication: { risk: 'sensitive', kind: 'handoff', zh: ['在原始窗口中输入账户或验证码', '自行完成所需的身份验证', '返回任务并核对登录状态'], en: ['Enter account details or codes in the original app', 'Complete authentication yourself', 'Return and verify signed-in state'] },
  file_import: { risk: 'normal', kind: 'handoff', zh: ['检查文件来源与导入目标', '选择要导入的文件', '确认导入结果与文件完整性'], en: ['Inspect file source and destination', 'Select files to import', 'Verify imported contents'] },
  system_settings: { risk: 'sensitive', kind: 'handoff', zh: ['确认设置项和预期影响', '根据本人意愿修改系统设置', '核对设置状态并返回任务'], en: ['Review the setting and impact', 'Change the setting only if you choose', 'Verify the setting and return'] },
  destructive_action: { risk: 'critical', kind: 'handoff', zh: ['检查将受影响的数据和不可逆后果', '自主决定取消或继续', '仅在确有必要时执行并复核'], en: ['Review affected data and irreversible consequences', 'Independently decide to cancel or proceed', 'Act only if necessary, then verify'] },
  general: { risk: 'normal', kind: 'guide', zh: ['检查当前屏幕和目标', '完成指定操作', '查看结果是否符合预期'], en: ['Inspect the current screen and target', 'Carry out the specified step', 'Verify the observed outcome'] }
});
export const BLUEPRINT_NAMES = Object.freeze(Object.keys(BP));
export function compileBlueprint(name, { locale = 'zh-CN', target = null } = {}) {
  if (!Object.hasOwn(BP, name)) throw new TypeError('Unknown blueprint');
  if (!['zh-CN','en-US'].includes(locale)) throw new TypeError('Unknown locale');
  const blueprint = BP[name];
  return {
    schemaVersion: 1, blueprint: name, kind: blueprint.kind, risk: blueprint.risk,
    steps: (locale === 'zh-CN' ? blueprint.zh : blueprint.en).map((title, index) => ({ id: `step_${index+1}`, title, requiresUserDecision: index === 1 && blueprint.risk !== 'normal' })),
    target, verification: 'independent_check_required', action: 'human_controls_original_application',
    estimatedTokenCost: 0
  };
}
