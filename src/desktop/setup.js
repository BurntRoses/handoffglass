import {renderConnectionSteps,permissionLabel} from './connection-view.mjs';
import {upgradeChoices,syncChoices} from './choice-controls.mjs';
'use strict';
upgradeChoices();
const translations = {
 "zh-CN": {
  "agent": "连接",
  "appearance": "外观",
  "ready": "完成",
  "choose": "连接应用",
  "host": "应用",
  "configTitle": "查看配置",
  "copy": "复制配置",
  "connect": "连接",
  "connecting": "正在连接…",
  "connectedRestart": "已添加，请重启 Codex。",
  "connectFailed": "未能连接，请手动添加配置。",
  "hostNote": "将配置添加到应用，重新连接工具。",
  "workbuddyConnectHint":"导入本地连接器后，在 WorkBuddy 中信任并启用它，再重新加载工具。",
  "prepareConnector":"生成连接器",
  "revealConnector":"打开文件夹",
  "workbuddyPrepared":"连接器已生成。导入此文件夹，再在 WorkBuddy 中信任、启用并重新加载工具。",
  "workbuddyFailed":"未能生成连接器。已有改动会保留，请检查文件内容和写入权限。",
  "visual": "外观",
  "style": "标注",
  "motion": "动态",
  "theme": "主题",
  "language": "语言",
  "density": "间距",
  "inspect": "允许定位窗口中的按钮和控件",
  "permission": "辅助功能设置",
  "done": "设置已保存",
  "doneDesc": "重启已连接的应用，告诉它你想做什么。",
  "back": "返回",
  "next": "继续",
  "finish": "完成",
  "copied": "已复制",
  "saved": "已保存",
  "error": "未能完成，请重试",
  "configUnavailable": "配置暂不可用",
  "loading": "正在准备…",
  "minimal": "极简",
  "handdrawn": "手绘",
  "luminous": "柔光",
  "gentle": "柔和",
  "expressive": "丰富",
  "off": "关闭",
  "system": "跟随系统",
  "light": "浅色",
  "dark": "深色",
  "normal": "标准",
  "compact": "紧凑"
 },
 "en-US": {
  "agent": "Connect",
  "appearance": "Appearance",
  "ready": "Finish",
  "choose": "Connect an app",
  "host": "App",
  "configTitle": "View configuration",
  "copy": "Copy configuration",
  "connect": "Connect",
  "connecting": "Connecting…",
  "connectedRestart": "Added. Restart Codex.",
  "connectFailed": "Could not connect. Add the configuration manually.",
  "hostNote": "Add the configuration to your app, then reconnect its tools.",
  "workbuddyConnectHint":"Import the local connector, trust and enable it in WorkBuddy, then reload its tools.",
  "prepareConnector":"Prepare connector",
  "revealConnector":"Show folder",
  "workbuddyPrepared":"Connector prepared. Import this folder, then trust, enable and reload its tools in WorkBuddy.",
  "workbuddyFailed":"Could not prepare the connector. Existing edits were kept. Check the files and write access.",
  "visual": "Appearance",
  "style": "Marks",
  "motion": "Motion",
  "theme": "Theme",
  "language": "Language",
  "density": "Spacing",
  "inspect": "Locate buttons and controls",
  "permission": "Accessibility settings",
  "done": "Settings saved",
  "doneDesc": "Restart your connected app, then tell it what you want to do.",
  "back": "Back",
  "next": "Continue",
  "finish": "Done",
  "copied": "Copied",
  "saved": "Saved",
  "error": "Could not complete. Try again.",
  "configUnavailable": "Configuration unavailable",
  "loading": "Preparing…",
  "minimal": "Minimal",
  "handdrawn": "Hand drawn",
  "luminous": "Soft glow",
  "gentle": "Gentle",
  "expressive": "Expressive",
  "off": "Off",
  "system": "System",
  "light": "Light",
  "dark": "Dark",
  "normal": "Standard",
  "compact": "Compact"
 }
};
Object.assign(translations['zh-CN'],{appearance:'权限与外观',visual:'权限与外观',ready:'准备情况',checkPermission:'检查权限',permissionFallback:'可以先使用文字引导，稍后再开启定位。',appearanceOptions:'调整外观',defer:'稍后连接',checkLoaded:'检查是否已加载',hostReady:'已收到此次接入的真实调用。',hostPending:'等待原会话检查连接，连接尚未验证。',reloadHint:'配置已写入。重启或重新加载 Codex 后，在原会话说“检查 HandoffGlass 连接”。',done:'设置已保存',doneDesc:'连接状态仍待确认。回到宿主完成加载和首次调用后，就可以开始任务。',readyDone:'已准备好',readyDesc:'回到已连接的应用，告诉它你想完成的任务。'});
Object.assign(translations['en-US'],{appearance:'Access and appearance',visual:'Access and appearance',ready:'Readiness',checkPermission:'Check access',permissionFallback:'You can use text guidance and enable lookup later.',appearanceOptions:'Adjust appearance',defer:'Connect later',checkLoaded:'Check loaded tools',hostReady:'A real call from this installation was received.',hostPending:'Waiting for a host call. Connection is not verified.',reloadHint:'Configuration written. Restart or reload Codex, then ask “Check the HandoffGlass connection” in your chat.',done:'Settings saved',doneDesc:'Connection is still pending. Return to your host to load the tools and make the first call.',readyDone:'Ready to use',readyDesc:'Return to your connected app and describe the task.'});
const $=id=>document.getElementById(id);
const safeLocale=value=>Object.hasOwn(translations,value)?value:'en-US';
let locale='zh-CN',step=0,platform='',statusReady=false,previewSerial=0,connectBusy=false;const connectResults={};
const feedback=$('feedback');const connectionStates={};let lastPermission=null,deferred=false;
function t(key){return translations[locale]?.[key] || translations['en-US'][key] || key;}
function report(message,isError=false){feedback.textContent=message;feedback.classList.toggle('is-error',isError);}
function translate(){syncChoices();
  document.documentElement.lang=locale;
  document.querySelectorAll('[data-t]').forEach(el=>{el.textContent=t(el.dataset.t)});
  $('next').querySelector('span').textContent=t(step===2?'finish':'next');
  $('next').disabled=step===0&&!connectionStates[$('host').value]?.hostVerified;
  $('defer').hidden=step!==0;
  document.querySelectorAll('[data-o]').forEach(el=>el.textContent=t(el.dataset.o));
  $('permission').hidden=platform!=='darwin';
  connectionLabels();renderConnection();renderPermission();
  const verified=connectionStates[$('host').value]?.hostVerified===true;
  $('readyHeading').textContent=t(verified?'readyDone':'done');$('finishDescription').textContent=t(verified?'readyDesc':'doneDesc');$('finishConnection').textContent=t(verified?'hostReady':'hostPending');document.querySelector('.finish-icon').dataset.verified=String(verified);
}
function connectionLabels(){const host=$('host').value,codex=host==='codex',workbuddy=host==='workbuddy',state=connectionStates[host];
 $('copy').textContent=t(connectBusy?'connecting':state?.installed?'checkLoaded':codex?'connect':workbuddy?'prepareConnector':'copy');
 document.querySelector('[data-t="hostNote"]').textContent=state?.nextAction==='review_hooks'?(locale==='zh-CN'?'工具已连接。如尚未审核，请到 Codex 的设置 → Hooks 检查 HandoffGlass 脚本。':'Tools are connected. If not reviewed yet, check HandoffGlass scripts in Codex Settings → Hooks.'):state?.hostVerified?t('hostReady'):state?.installed?t(workbuddy?'workbuddyPrepared':'reloadHint'):connectResults[host]?t(connectResults[host]):codex?'':t(workbuddy?'workbuddyConnectHint':'hostNote');
 $('revealConnector').hidden=!(workbuddy&&(state?.installed||connectResults[host]==='workbuddyPrepared'));
}
function renderConnection(){const state=connectionStates[$('host').value];renderConnectionSteps($('connectionSteps'),state,locale);$('connectionEvidence').textContent=state?t(state.hostVerified?'hostReady':'hostPending'):'';}
async function refreshConnection(){const host=$('host').value;if(!['codex','workbuddy'].includes(host)){renderConnection();return;}
 try{const result=await window.hgSetup.connection(host);if(result?.ok)connectionStates[host]=result.status||result;}catch{report(t('error'),true);}translate();
}
function renderPermission(){$('permissionStatus').textContent=permissionLabel(lastPermission,locale);}
async function refreshPermission(){try{const result=await window.hgSetup.permissionStatus();lastPermission=result?.status||result;}catch{lastPermission=null;}renderPermission();}
function showStep(index){step=Math.max(0,Math.min(2,index));document.querySelectorAll('[data-screen]').forEach(el=>{el.hidden=Number(el.dataset.screen)!==step});document.querySelectorAll('[data-step]').forEach(el=>{const position=Number(el.dataset.step);el.classList.toggle('is-active',position===step);el.classList.toggle('is-done',position<step);position===step?el.setAttribute('aria-current','step'):el.removeAttribute('aria-current')});$('back').disabled=step===0;report('');translate();}
function applyTheme(value){document.documentElement.dataset.theme=value==='light'?'light':value==='dark'?'dark':'system';}
async function updatePreview(){
 const serial=++previewSerial;const host=$('host').value;connectionLabels();$('format').textContent=host==='codex'?'TOML':'JSON';$('configPreview').textContent=t('loading');
 try{const response=await window.hgSetup.preview(host);if(serial!==previewSerial)return;$('configPreview').textContent=response?.ok?response.content:t('configUnavailable');$('copy').disabled=!response?.ok;}
 catch{if(serial===previewSerial){$('configPreview').textContent=t('configUnavailable');$('copy').disabled=true;}}
}
$('host').addEventListener('change',()=>{void updatePreview();void refreshConnection();});
$('copy').addEventListener('click',async()=>{
 const host=$('host').value;
 if(['codex','workbuddy'].includes(host)){
  if(connectionStates[host]?.installed){await refreshConnection();return;}
  if(connectBusy)return;connectBusy=true;$('copy').disabled=true;connectionLabels();
  try{const result=await window.hgSetup.connect(host);connectResults[host]=result?.ok?(host==='codex'?'connectedRestart':'workbuddyPrepared'):(host==='codex'?'connectFailed':'workbuddyFailed');}catch{connectResults[host]=host==='codex'?'connectFailed':'workbuddyFailed';}
  finally{connectBusy=false;$('copy').disabled=false;connectionLabels();await refreshConnection();}return;
 }
 try{const result=await window.hgSetup.copy($('host').value);report(result?.ok?t('copied'):t('error'),!result?.ok);}catch{report(t('error'),true);}
});
$('revealConnector').addEventListener('click',async()=>{try{const result=await window.hgSetup.revealConnector();if(!result?.ok)report(t('error'),true);}catch{report(t('error'),true);}});
$('copyManual').addEventListener('click',async()=>{try{const result=await window.hgSetup.copy($('host').value);report(result?.ok?t('copied'):t('error'),!result?.ok);}catch{report(t('error'),true);}});
$('permission').addEventListener('click',async()=>{try{const response=await window.hgSetup.permission();if(!response?.ok)report(t('error'),true);}catch{report(t('error'),true);}});
$('theme').addEventListener('change',()=>applyTheme($('theme').value));
$('locale').addEventListener('change',()=>{locale=safeLocale($('locale').value);translate();});
$('back').addEventListener('click',()=>showStep(step-1));
$('next').addEventListener('click',async()=>{
 if(step===0){await refreshConnection();if(!connectionStates[$('host').value]?.hostVerified){report(t('hostPending'));return;}}
 if(step===1){
   const settings={visualStyle:$('visualStyle').value,motion:$('motion').value,theme:$('theme').value,locale:$('locale').value,density:$('density').value,accessibility:$('accessibility').checked};
   try{const result=await window.hgSetup.save(settings);if(!result?.ok){report(t('error'),true);return;}}catch{report(t('error'),true);return;}
 }
 if(step===2){try{await window.hgSetup.close();}catch{report(t('error'),true);}return;}
 showStep(step+1);if(step===1)void refreshPermission();
});
document.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>{const target=Number(button.dataset.step);if(target<=step)showStep(target);}));
(async()=>{
  const response=await window.hgSetup.status();
  if(!response?.ok)throw Error(t('error'));
  statusReady=true;platform=response.platform;
  for(const [key,value] of Object.entries(response.preferences||{}))if($(key)&&typeof value==='string')$(key).value=value;
  $('accessibility').checked=response.accessibility===true;
  locale=safeLocale(response.preferences?.locale||'zh-CN');
  applyTheme(response.preferences?.theme||'system');showStep(0);await updatePreview();await refreshConnection();await refreshPermission();
})().catch(error=>{report(error.message||t('error'),true);$('copy').disabled=true;});

$('defer').addEventListener('click',()=>{deferred=true;showStep(1);void refreshPermission();});
$('checkPermission').addEventListener('click',refreshPermission);
$('accessibility').addEventListener('change',async()=>{
 const settings={visualStyle:$('visualStyle').value,motion:$('motion').value,theme:$('theme').value,locale:$('locale').value,density:$('density').value,accessibility:$('accessibility').checked};
 try{const result=await window.hgSetup.save(settings);if(!result?.ok)throw Error();await refreshPermission();}catch{report(t('error'),true);}
});
window.addEventListener('focus',()=>{void refreshConnection();if(step===1)void refreshPermission();});
