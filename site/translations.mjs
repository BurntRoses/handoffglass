import {installPrompts} from './install-prompts.mjs';

export const translations = {
  en: {
    'nav.experience':'Experience','nav.features':'Features','nav.integrations':'Integrations','nav.start':'Get started',
    'hero.eyebrow':'LOCAL INTERACTION RUNTIME','hero.line1':'Desktop guidance','hero.line2':'step by step.','hero.lead':'Your agent marks the target and shows one action. After you act, it checks the result and continues.','hero.explore':'Try the preview','hero.setup':'Set it up','hero.note':'Target marks, step cards and pause controls.',
    'demo.workspace':'Workspace settings','demo.heading':'Review the next step','demo.body':'Your connected workspace is requesting an action.','demo.option1':'Connected application','demo.option1sub':'Request details','demo.option2':'Permissions','demo.option2sub':'Review before continuing','demo.later':'Later','demo.review':'Review access','demo.tag':'YOUR NEXT STEP','demo.yourturn':'Your turn','demo.cardtitle':'Take a moment to review','demo.cardbody':'Decide in the original window.','demo.completed':"I've finished",'demo.decline':'Decline','demo.preview':'INTERACTIVE CONCEPT PREVIEW',
    'scene.focus':'Focus','scene.sequence':'Sequence','scene.caution':'Review',
    'rail.title':'From tool calls to screen cues, locally.','rail.broker':'Local broker','rail.marks':'Screen marks',
    'features.eyebrow':'THE INTERACTION LAYER','features.heading':'Guide, act, verify.','features.intro':"See the target, complete the action and return the result to your agent.",
    'features.visual.title':'Mark the target','features.visual.body':'Animated paths, softly lit focus areas and scenes composed in layers. Designed to guide without getting in the way.',
    'features.handoff.title':'Report your action','features.handoff.body':'People choose. The agent receives an explicit result and decides how to proceed.',
    'features.local.title':'Run locally','features.local.body':'One shared local broker, on-device visual preferences and opt-in native control lookup.',
    'flow.eyebrow':'FROM ONE MOMENT TO THE NEXT','flow.heading':'From guidance to verification.','flow.intro':"Continue in the same session, with pause and end controls available.",
    'flow.one.title':'Agent asks','flow.one.body':'Locate a control or request a handoff.','flow.two.title':'You decide','flow.two.body':'Follow the cue. Complete or decline.','flow.three.title':'Agent resumes','flow.three.body':'Check the result. Continue the task.',
    'integrations.eyebrow':'PLUGIN PREVIEW','integrations.heading':'One runtime. Your agent.','integrations.body':'MCP and Skills share a local renderer. Native adapters are available for trials; real model task loops remain unverified.','integrations.link':'Setup and verification status',
    'start.title':'Install','start.subtitle':'Send this to your agent.','start.label':'To your agent','start.prompt':installPrompts.en,'start.copy':'Copy','start.copied':'Copied','start.setupGuide':'Usage',
    'footer.text':'The handoff, made visible.','footer.preview':'Engineering preview','footer.license':'Free for noncommercial use',
    'demo.completeText':'Reported complete','demo.declineText':'Declined','demo.completedBody':'The agent can now check the outcome.','demo.declinedBody':'The agent will respect your decision.'
  },
  zh: {
    'nav.experience':'交互体验','nav.features':'核心能力','nav.integrations':'平台接入','nav.start':'快速开始',
    'hero.eyebrow':'本地交互运行时','hero.line1':'桌面操作，','hero.line2':'逐步引导。','hero.lead':'Agent 在目标旁显示标记与说明。你操作后，Agent 核实结果并继续任务。','hero.explore':'试用交互预览','hero.setup':'开始使用','hero.note':'目标标记、步骤卡片与暂停控制。',
    'demo.workspace':'工作区设置','demo.heading':'请确认下一步操作','demo.body':'已连接的工作区正请求你完成一项操作。','demo.option1':'已连接的应用','demo.option1sub':'查看请求详情','demo.option2':'访问权限','demo.option2sub':'继续前请核对','demo.later':'稍后','demo.review':'查看权限','demo.tag':'下一步操作','demo.yourturn':'现在由你操作','demo.cardtitle':'请先核对界面信息','demo.cardbody':'在原窗口查看访问权限。','demo.completed':'我已完成','demo.decline':'拒绝','demo.preview':'可交互概念演示',
    'scene.focus':'聚焦','scene.sequence':'分步','scene.caution':'核对',
    'rail.title':'从工具调用到屏幕提示，都在本机。','rail.broker':'本机服务','rail.marks':'屏幕标记',
    'features.eyebrow':'视觉交互层','features.heading':'看清目标，完成操作。','features.intro':'圈画目标、呈现当前步骤，并将操作结果交回 Agent。',
    'features.visual.title':'目标标记','features.visual.body':'使用圈画、箭头与聚焦遮罩指出目标，标记随窗口移动。',
    'features.handoff.title':'操作交接','features.handoff.body':'你完成或拒绝；Agent 收到明确结果，再决定如何继续。',
    'features.local.title':'本地运行','features.local.body':'多个 Agent 共用本机服务，视觉偏好本地保存，系统控件定位按需授权。',
    'flow.eyebrow':'操作流程','flow.heading':'从提示到核实','flow.intro':'同一会话逐步呈现操作，并保留暂停和结束入口。',
    'flow.one.title':'Agent 发起','flow.one.body':'定位控件，或请求人工接管。','flow.two.title':'你来操作','flow.two.body':'按照指引，自行完成或拒绝。','flow.three.title':'Agent 继续','flow.three.body':'核验结果，继续原任务。',
    'integrations.eyebrow':'插件试用','integrations.heading':'一个运行时，多种接入方式。','integrations.body':'MCP 与 Skill 共用本地绘制进程。原生接入可供试用，真实模型任务闭环仍待验证。','integrations.link':'安装步骤与验证状态',
    'start.title':'安装','start.subtitle':'把这句话发给你的 Agent。','start.label':'发送给 Agent','start.prompt':installPrompts.zh,'start.copy':'复制','start.copied':'已复制','start.setupGuide':'使用',
    'footer.text':'桌面操作，逐步引导。','footer.preview':'测试预览','footer.license':'非商业用途免费',
    'demo.completeText':'已报告完成','demo.declineText':'已拒绝','demo.completedBody':'Agent 可以继续核验实际结果。','demo.declinedBody':'本次引导已停止。'
  }
};
