'use strict';
const translations = Object.freeze({
 'zh-CN':{
  tagline:'人和 Agent 之间，少一点距离。',hero1:'让下一步，',hero2:'清晰可见。',subtitle:'真正需要你做决定时，HandoffGlass 会指出位置，再把任务交回 Agent。',artLabel:'下一步操作',welcome:'快速设置',agent:'连接',appearance:'外观',ready:'完成',choose:'连接你的 Agent',chooseDesc:'选择常用的 Agent，将本机配置添加到它的 MCP 设置中。',host:'Agent / Harness',configTitle:'本机连接配置',copy:'复制配置',hostNote:'复制后粘贴到宿主的 MCP 配置，重新加载工具即可。',visual:'调成你喜欢的样子',visualDesc:'外观设置只保存在本机，后续所有 Agent 共用。',style:'视觉风格',motion:'动态效果',theme:'界面明暗',language:'界面语言',density:'信息密度',inspect:'允许只读控件定位',inspectDesc:'查询当前前台应用的控件位置。默认关闭，随时可更改。',permission:'打开系统辅助功能设置 ↗',done:'设置好了。',doneDesc:'你可以返回刚才的 Agent，重新加载 MCP 工具开始使用。',running:'本地服务已就绪',runningDesc:'配置已经准备好。请在 Agent 中确认能看到 HandoffGlass 工具。',note:'你负责决定。Agent 负责继续完成任务。',private:'本机运行 · 无需云账号',back:'返回',next:'继续',finish:'完成',copied:'配置已复制',saved:'偏好已保存',error:'操作失败，请重试',configUnavailable:'暂时无法预览配置',loading:'正在准备配置…'},
 'en-US':{
  tagline:'A closer way to work with your agent.',hero1:'The next step,',hero2:'made visible.',subtitle:'When a decision needs you, HandoffGlass points the way and brings your agent back into the flow.',artLabel:'YOUR NEXT STEP',welcome:'Quick setup',agent:'Connect',appearance:'Appearance',ready:'Finish',choose:'Connect your agent',chooseDesc:'Choose a host and add this device’s configuration to its MCP settings.',host:'Agent / Harness',configTitle:'Local configuration',copy:'Copy configuration',hostNote:'Paste into your host’s MCP settings, then reload its tools.',visual:'Make it yours',visualDesc:'Your visual preferences stay on this device, shared across agents.',style:'Visual style',motion:'Motion',theme:'Appearance',language:'Language',density:'Information density',inspect:'Allow read-only element lookup',inspectDesc:'Locates foreground UI controls on request. Off by default; change anytime.',permission:'Open system accessibility settings ↗',done:'You’re ready.',doneDesc:'Return to your agent and reload MCP tools to get started.',running:'Local service is ready',runningDesc:'Your configuration is prepared. Confirm HandoffGlass tools appear in your agent.',note:'You make the decision. Your agent picks up the task.',private:'On-device · No cloud account',back:'Back',next:'Continue',finish:'Finish',copied:'Configuration copied',saved:'Preferences saved',error:'Could not complete the action',configUnavailable:'Configuration preview unavailable',loading:'Preparing configuration…'}
});
const $=id=>document.getElementById(id);
const safeLocale=value=>Object.hasOwn(translations,value)?value:'en-US';
let locale='zh-CN',step=0,platform='',statusReady=false,previewSerial=0;
const feedback=$('feedback');
function t(key){return translations[locale]?.[key] || translations['en-US'][key] || key;}
function report(message,isError=false){feedback.textContent=message;feedback.classList.toggle('is-error',isError);}
function translate(){
  document.documentElement.lang=locale;
  document.querySelectorAll('[data-t]').forEach(el=>{el.textContent=t(el.dataset.t)});
  $('next').querySelector('span').textContent=t(step===2?'finish':'next');
  $('stepCounter').textContent=`STEP 0${step+1} / 03`;
  $('permission').hidden=platform!=='darwin';
}
function showStep(index){step=Math.max(0,Math.min(2,index));document.querySelectorAll('[data-screen]').forEach(el=>{el.hidden=Number(el.dataset.screen)!==step});document.querySelectorAll('[data-step]').forEach(el=>{const position=Number(el.dataset.step);el.classList.toggle('is-active',position===step);el.classList.toggle('is-done',position<step);position===step?el.setAttribute('aria-current','step'):el.removeAttribute('aria-current')});$('back').disabled=step===0;report('');translate();}
function applyTheme(value){document.documentElement.dataset.theme=value==='light'?'light':value==='dark'?'dark':'system';}
async function updatePreview(){
 const serial=++previewSerial;const host=$('host').value;$('format').textContent=host==='codex'?'MCP / TOML':'MCP / JSON';$('configPreview').textContent=t('loading');
 try{const response=await window.hgSetup.preview(host);if(serial!==previewSerial)return;$('configPreview').textContent=response?.ok?response.content:t('configUnavailable');$('copy').disabled=!response?.ok;}
 catch{if(serial===previewSerial){$('configPreview').textContent=t('configUnavailable');$('copy').disabled=true;}}
}
$('host').addEventListener('change',updatePreview);
$('copy').addEventListener('click',async()=>{
 try{const result=await window.hgSetup.copy($('host').value);report(result?.ok?t('copied'):(result?.error||t('error')),!result?.ok);}catch{report(t('error'),true);}
});
$('permission').addEventListener('click',async()=>{try{const response=await window.hgSetup.permission();if(!response?.ok)report(response?.error||t('error'),true);}catch{report(t('error'),true);}});
$('theme').addEventListener('change',()=>applyTheme($('theme').value));
$('locale').addEventListener('change',()=>{locale=safeLocale($('locale').value);translate();});
$('back').addEventListener('click',()=>showStep(step-1));
$('next').addEventListener('click',async()=>{
 if(step===1){
   const settings={visualStyle:$('visualStyle').value,motion:$('motion').value,theme:$('theme').value,locale:$('locale').value,density:$('density').value,accessibility:$('accessibility').checked};
   try{const result=await window.hgSetup.save(settings);if(!result?.ok){report(result?.error||t('error'),true);return;}}catch{report(t('error'),true);return;}
 }
 if(step===2){try{await window.hgSetup.close();}catch{report(t('error'),true);}return;}
 showStep(step+1);
});
document.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>{const target=Number(button.dataset.step);if(target<=step)showStep(target);}));
(async()=>{
  const response=await window.hgSetup.status();
  if(!response?.ok)throw Error(t('error'));
  statusReady=true;platform=response.platform;
  for(const [key,value] of Object.entries(response.preferences||{}))if($(key)&&typeof value==='string')$(key).value=value;
  $('accessibility').checked=response.accessibility===true;
  locale=safeLocale(response.preferences?.locale||'zh-CN');
  applyTheme(response.preferences?.theme||'system');showStep(0);await updatePreview();
})().catch(error=>{report(error.message||t('error'),true);$('copy').disabled=true;});
