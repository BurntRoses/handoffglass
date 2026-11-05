/** Compact shared vocabulary for the Agent, desktop library and gallery. */
import { EFFECTS, MASK_STYLES, EXIT_STYLES, TEMPLATE_NAMES } from './scene.mjs';
export const MARK_CATEGORIES = Object.freeze([
  {id:'focus', zh:'聚焦与遮罩', en:'Focus & shade', shapes:['spotlight','glow','box','bracket']},
  {id:'point', zh:'指向与点位', en:'Point & locate', shapes:['arrow','dot','ripple','halo','cursor','crosshair']},
  {id:'ink', zh:'圈画与笔迹', en:'Circles & ink', shapes:['ring','double_ring','scribble']},
  {id:'read', zh:'文字与区域', en:'Text & regions', shapes:['highlight','underline','strike']},
  {id:'status', zh:'步骤与反馈', en:'Steps & feedback', shapes:['badge','check','cross']}
]);
export const MARK_NAMES = Object.freeze({
  spotlight:['聚焦遮罩','Spotlight'], glow:['区域柔光','Region glow'], box:['柔角描边','Outline'], bracket:['四角取景','Corners'],
  arrow:['弧线箭头','Arrow'], dot:['定位圆点','Dot'], ripple:['点位涟漪','Ripple'], halo:['呼吸光环','Halo'], cursor:['引导指针','Pointer'], crosshair:['精确定位','Crosshair'],
  ring:['精细圈选','Ring'], double_ring:['双线圈选','Double ring'], scribble:['手绘双圈','Ink circles'],
  highlight:['荧光笔','Highlighter'], underline:['双笔下划线','Underline'], strike:['删除线','Strike-through'],
  badge:['步骤角标','Step badge'], check:['勾记','Check mark'], cross:['叉记','Cross mark']
});
export const VISUAL_CAPABILITIES = Object.freeze({
  categories:MARK_CATEGORIES.map(({id,shapes})=>({id,shapes})),
  templates:TEMPLATE_NAMES, effects:EFFECTS, maskStyles:MASK_STYLES, exits:EXIT_STYLES,
  defaults:'Use one mark per action; focus=spotlight, point=arrow, beacon=ripple, region=glow. Stable mark ids preserve playback during movement.',
  lifecycle:'Entrances and holds are local. User reports retire marks with the selected exit. Target loss, pause, disable and disconnect clear immediately. No animation proves completion.'
});
