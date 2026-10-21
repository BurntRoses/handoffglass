'use strict';
import { upgradeChoices, syncChoices } from './choice-controls.mjs';
import { renderOverlay } from './overlay-renderer.mjs';
const lex = {
 "zh-CN": {
  "event_session_started":"引导已开始","event_scene_updated":"已显示下一步","event_session_finished":"引导已结束","event_user_action":"已提交操作结果","event_verification_required":"等待核实","event_agent_ready":"准备下一步",
  "phase_verifying":"等待核实","phase_next_step":"准备下一步","pausedTitle":"引导已停用","pausedDesc":"连接和设置仍保留。需要时可在连接页重新启用。",
  "overview": "引导",
  "connections": "连接",
  "appearance": "外观",
  "diagnostics": "帮助",
  "refresh": "刷新",
  "welcome": "等待下一步",
  "welcomeDesc": "在已连接的应用中开始任务，需要你操作时，提示会出现在目标附近。",
  "manageConnection": "管理连接",
  "desktopTitle": "桌面引导",
  "handoffTitle": "当前操作",
  "activityTitle": "最近连接",
  "connectTitle": "连接",
  "connectDesc": "将配置添加到应用，重新连接工具。",
  "workbuddyConnectHint": "导入本地连接器后，在 WorkBuddy 中信任并启用它，再重新加载工具。",
  "prepareConnector":"生成连接器",
  "revealConnector":"打开文件夹",
  "workbuddyPrepared":"连接器已生成。导入此文件夹，再在 WorkBuddy 中信任、启用并重新加载工具。",
  "workbuddyFailed":"未能生成连接器。已有改动会保留，请检查文件内容和写入权限。",
  "integrationTitle": "连接管理",
  "integrationInspect": "查看状态",
  "integrationCleanup": "查看移除内容",
  "integrationConfirm": "移除连接",
  "integrationNotInstalled": "尚未安装此连接",
  "integrationInstalled": "已写入本机配置和技能",
  "integrationModified": "发现修改，将保留相关内容",
  "integrationBundleReady": "本地连接器已生成，WorkBuddy 中的连接尚未验证",
  "integrationCleanupReady": "将进行以下变更。修改过的文件和其他应用设置会保留。",
  "integrationCleanupDone": "本机连接内容已移除。重启应用后生效。",
  "integrationUnsupported": "此应用暂不支持自动卸载，请按应用自己的设置移除连接。",
  "host": "应用",
  "localConfig": "查看配置",
  "copy": "复制配置",
  "connect": "连接",
  "connecting": "正在连接…",
  "connectedRestart": "已添加，请重启 Codex。",
  "connectFailed": "未能连接，请手动添加配置。",
  "styleTitle": "外观",
  "visual": "标注",
  "motion": "动态",
  "theme": "主题",
  "language": "语言",
  "density": "间距",
  "inspect": "定位窗口中的按钮和控件",
  "inspectDesc": "用于显示位置标记，不会代你点击。还需在系统设置中授予辅助功能权限。",
  "toolsEnabled": "桌面引导",
  "continuousEnabled": "接收后续步骤",
  "openPermission": "系统设置",
  "save": "保存",
  "healthTitle": "帮助",
  "technicalDetails": "详细信息",
  "checkBroker": "本地服务",
  "checkDesktop": "桌面引导",
  "checkAgent": "最近请求",
  "checkDisplays": "显示器",
  "checkSession": "当前操作",
  "checkPermission": "控件定位",
  "running": "运行中",
  "reconnecting": "连接中",
  "present": "已就绪",
  "idle": "无",
  "waiting": "等待你操作",
  "recent": "刚刚收到请求",
  "noActivity": "暂无请求",
  "enabled": "已允许",
  "disabled": "未允许",
  "unavailable": "暂不可用",
  "saved": "已保存",
  "copied": "已复制",
  "failed": "未能完成，请重试",
  "moment": "已刷新",
  "loading": "正在准备…",
  "na": "暂不可用",
  "selfTestTitle": "连接检查",
  "selfTestRun": "检查",
  "selfTestRunning": "正在检查…",
  "selfTestPassed": "连接正常",
  "selfTestPassedHint": "",
  "selfTestFailed": "连接失败",
  "selfTestFailHint": "请重启 HandoffGlass 后重试。",
  "selfTestTimeout": "连接超时",
  "selfTestTimeoutHint": "请重启 HandoffGlass 后重试。",
  "selfTestBusy": "正在检查…",
  "displayTitle": "多屏使用",
  "displayNone": "未检测到显示器",
  "displayNote": "图示来自系统报告的位置；是否准确跟随，还需在实际屏幕上试用。",
  "displayCount": "检测到 {count} 块屏幕",
  "displayOne": "检测到 1 块屏幕",
  "displayMapLabel": "显示器相对位置",
  "displaySetupMac": "接上外屏，在显示器设置中选择扩展显示器。镜像会显示相同内容。",
  "displaySetupWindows": "接上外屏，按 Win + P 选择“扩展”。",
  "displaySetupOther": "接上外屏，在系统显示设置中选择扩展桌面。",
  "displayArrange": "在系统设置中，把屏幕排列成与桌上一致的位置。",
  "displayTry": "把一个普通窗口移到另一块屏幕，再发起引导，检查提示是否跟随。",
  "displaySettings": "打开显示设置",
  "displayRefresh": "刷新检测",
  "displaySettingsOpened": "在系统设置中完成调整，返回后刷新检测。",
  "displaySettingsMacFailed": "请手动打开系统设置 → 显示器。",
  "displaySettingsWindowsFailed": "请手动打开设置 → 系统 → 屏幕。",
  "displaySettingsFailed": "请手动打开系统的显示设置。",
  "displayLabel": "显示器",
  "reportCopy": "复制诊断信息",
  "reportCopied": "已复制",
  "observedHostsTitle": "最近连接",
  "evidenceEmpty": "暂无连接记录",
  "ago": "秒前",
  "calls": "次请求",
  "unknownHost": "其他应用",
  "layoutConsistent": "显示布局数据一致",
  "layoutInconsistent": "显示器布局异常，请重新连接。",
  "layoutUnknown": "布局暂不可用",
  "timelineTitle": "操作记录",
  "timelineEmpty": "暂无操作",
  "event_started": "开始引导",
  "event_target_acquired": "已定位",
  "event_target_moved": "位置已更新",
  "event_target_lost": "目标不可见",
  "event_target_restored": "已重新定位",
  "event_display_changed": "显示器已变化",
  "event_desktop_unavailable": "桌面引导暂不可用",
  "event_scene_changed": "标注已更新",
  "event_tracking_released": "引导已更新",
  "event_completed": "你已确认完成",
  "event_declined": "已拒绝",
  "event_cancelled": "已取消",
  "event_expired": "已超时",
  "event_superseded": "已替换",
  "preview": "标注预览",
  "previewTarget": "继续",
  "replay": "重播",
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
  "compact": "紧凑",
  "activeTitle": "等待你操作",
  "activeDesc": "请在原窗口完成当前操作。",
  "offlineTitle": "正在连接",
  "offlineDesc": "桌面引导暂不可用，请稍后重试。"
 },
 "en-US": {
  "event_session_started":"Guidance started","event_scene_updated":"Next step shown","event_session_finished":"Guidance ended","event_user_action":"Action reported","event_verification_required":"Awaiting verification","event_agent_ready":"Preparing next step",
  "phase_verifying":"Awaiting verification","phase_next_step":"Preparing next step","pausedTitle":"Guidance is paused","pausedDesc":"Connections and settings are kept. Re-enable it in Connections when needed.",
  "overview": "Guidance",
  "connections": "Connections",
  "appearance": "Appearance",
  "diagnostics": "Help",
  "refresh": "Refresh",
  "welcome": "Ready when needed",
  "welcomeDesc": "Start a task in Codex. Guidance appears when a step needs you.",
  "manageConnection": "Manage connections",
  "desktopTitle": "Desktop guidance",
  "handoffTitle": "Current step",
  "activityTitle": "Recent connection",
  "connectTitle": "Connections",
  "connectDesc": "Add the configuration to your app, then reconnect its tools.",
  "workbuddyConnectHint": "Import the local connector, trust and enable it in WorkBuddy, then reload its tools.",
  "prepareConnector":"Prepare connector",
  "revealConnector":"Show folder",
  "workbuddyPrepared":"Connector prepared. Import this folder, then trust, enable and reload its tools in WorkBuddy.",
  "workbuddyFailed":"Could not prepare the connector. Existing edits were kept. Check the files and write access.",
  "integrationTitle": "Connection management",
  "integrationInspect": "Check status",
  "integrationCleanup": "Review removal",
  "integrationConfirm": "Remove connection",
  "integrationNotInstalled": "This connection is not installed",
  "integrationInstalled": "Local configuration and Skill installed",
  "integrationModified": "Changed content will be kept",
  "integrationBundleReady": "Local connector prepared; the WorkBuddy connection is not yet verified",
  "integrationCleanupReady": "Review the changes below. Edited files and other app settings are kept.",
  "integrationCleanupDone": "Local connection removed. Restart the app to apply it.",
  "integrationUnsupported": "Automatic removal is not available for this app. Remove the connection in its own settings.",
  "host": "App",
  "localConfig": "View configuration",
  "copy": "Copy configuration",
  "connect": "Connect",
  "connecting": "Connecting…",
  "connectedRestart": "Added. Restart Codex.",
  "connectFailed": "Could not connect. Add the configuration manually.",
  "styleTitle": "Appearance",
  "visual": "Marks",
  "motion": "Motion",
  "theme": "Theme",
  "language": "Language",
  "density": "Spacing",
  "inspect": "Locate buttons and controls",
  "inspectDesc": "Used to place visual marks. It never clicks. System Accessibility permission is also required.",
  "toolsEnabled": "Desktop guidance",
  "continuousEnabled": "Receive follow-up steps",
  "openPermission": "System settings",
  "save": "Save",
  "healthTitle": "Help",
  "technicalDetails": "Details",
  "checkBroker": "Local service",
  "checkDesktop": "Desktop guidance",
  "checkAgent": "Recent request",
  "checkDisplays": "Displays",
  "checkSession": "Current step",
  "checkPermission": "Element lookup",
  "running": "Running",
  "reconnecting": "Connecting",
  "present": "Ready",
  "idle": "None",
  "waiting": "Waiting for you",
  "recent": "Request received",
  "noActivity": "No recent requests",
  "enabled": "Allowed",
  "disabled": "Not allowed",
  "unavailable": "Unavailable",
  "saved": "Saved",
  "copied": "Copied",
  "failed": "Could not complete. Try again.",
  "moment": "Updated",
  "loading": "Preparing…",
  "na": "Unavailable",
  "selfTestTitle": "Connection check",
  "selfTestRun": "Check",
  "selfTestRunning": "Checking…",
  "selfTestPassed": "Connection ready",
  "selfTestPassedHint": "",
  "selfTestFailed": "Connection failed",
  "selfTestFailHint": "Restart HandoffGlass and try again.",
  "selfTestTimeout": "Connection timed out",
  "selfTestTimeoutHint": "Restart HandoffGlass and try again.",
  "selfTestBusy": "Checking…",
  "displayTitle": "Displays",
  "displayNone": "No displays detected",
  "displayNote": "The diagram uses positions reported by your system. Try guidance on each screen to check tracking.",
  "displayCount": "{count} displays detected",
  "displayOne": "1 display detected",
  "displayMapLabel": "Relative display positions",
  "displaySetupMac": "Connect a display, then choose extended display in Displays settings. Mirroring shows the same content.",
  "displaySetupWindows": "Connect a display, then press Win + P and choose Extend.",
  "displaySetupOther": "Connect a display and choose an extended desktop in system display settings.",
  "displayArrange": "In system settings, arrange the displays to match their positions on your desk.",
  "displayTry": "Move an ordinary window to the other screen, then start guidance and check that the marks follow.",
  "displaySettings": "Open display settings",
  "displayRefresh": "Refresh displays",
  "displaySettingsOpened": "Finish arranging your displays in system settings, then return and refresh.",
  "displaySettingsMacFailed": "Open System Settings → Displays manually.",
  "displaySettingsWindowsFailed": "Open Settings → System → Display manually.",
  "displaySettingsFailed": "Open your system display settings manually.",
  "displayLabel": "Display",
  "reportCopy": "Copy diagnostics",
  "reportCopied": "Copied",
  "observedHostsTitle": "Recent connections",
  "evidenceEmpty": "No connections recorded",
  "ago": "seconds ago",
  "calls": "requests",
  "unknownHost": "Other app",
  "layoutConsistent": "Display layout data is consistent",
  "layoutInconsistent": "Display layout mismatch. Reconnect your display.",
  "layoutUnknown": "Layout unavailable",
  "timelineTitle": "Activity",
  "timelineEmpty": "No activity",
  "event_started": "Guidance started",
  "event_target_acquired": "Target located",
  "event_target_moved": "Position updated",
  "event_target_lost": "Target hidden",
  "event_target_restored": "Target located again",
  "event_display_changed": "Displays changed",
  "event_desktop_unavailable": "Guidance unavailable",
  "event_scene_changed": "Marks updated",
  "event_tracking_released": "Guidance updated",
  "event_completed": "You confirmed completion",
  "event_declined": "Declined",
  "event_cancelled": "Cancelled",
  "event_expired": "Timed out",
  "event_superseded": "Replaced",
  "preview": "Mark preview",
  "previewTarget": "Continue",
  "replay": "Replay",
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
  "compact": "Compact",
  "activeTitle": "Your turn",
  "activeDesc": "Complete the current step in its original window.",
  "offlineTitle": "Connecting",
  "offlineDesc": "Desktop guidance is unavailable. Try again shortly."
 }
};
const $=id=>document.getElementById(id);
upgradeChoices();
let prefs=null,currentPage='overview',busy=false,serial=0,settingsDirty=false,testBusy=false,testLast=null;
let hostPlatform=null,lastDisplays=null,displaySettingsState=null;
const translateKey=key=>(lex[prefs?.locale]||lex['zh-CN'])[key]||key;
function applyLocale(){const lang=lex[prefs?.locale]?prefs.locale:'zh-CN';document.documentElement.lang=lang;document.documentElement.dataset.theme=prefs?.theme||'system';document.querySelectorAll('[data-i]').forEach(el=>{el.textContent=translateKey(el.dataset.i)});document.querySelectorAll('[data-option]').forEach(el=>{el.textContent=translateKey(el.dataset.option)});document.querySelectorAll('[data-label]').forEach(el=>el.setAttribute('aria-label',translateKey(el.dataset.label)));$('crumb').textContent=translateKey(currentPage);syncChoices();connectionLabels();renderLocal();renderDisplays(lastDisplays);}
function showPage(page){if(!['overview','connections','appearance','diagnostics'].includes(page))return;currentPage=page;document.querySelectorAll('[data-view]').forEach(el=>el.hidden=el.dataset.view!==page);document.querySelectorAll('[data-page]').forEach(el=>el.getAttribute('data-page')===page?el.setAttribute('aria-current','page'):el.removeAttribute('aria-current'));$('crumb').textContent=translateKey(page);if(page==='connections'){void preview();void refresh();void inspectIntegration();}if(page==='diagnostics'||page==='overview')void refresh();if(page==='diagnostics')void refreshDisplays();if(page==='appearance')requestAnimationFrame(renderPreview);}
function value(id,text){$(id).textContent=text;}
let observedHosts=[];
function renderHosts(){
  const list=$('hostEvidence');list.replaceChildren();
  if(!observedHosts.length){const empty=document.createElement('p');empty.className='evidence-empty';empty.textContent=translateKey('evidenceEmpty');list.append(empty);return;}
  for(const item of observedHosts){
    const host=document.createElement('div');host.className='evidence-item';host.setAttribute('role','listitem');
    const name=document.createElement('span');name.className='evidence-name';
    // Fixed host IDs only; no user-controlled HTML or device path.
    name.textContent=item.host==='unidentified'?translateKey('unknownHost'):item.host;
    const meta=document.createElement('span');meta.className='evidence-metadata';
    meta.textContent=`${item.calls} ${translateKey('calls')} · ${item.agoSeconds} ${translateKey('ago')}`;
    host.append(name,meta);list.append(host);
  }
}
let recentTimeline=[];
function renderTimeline(){
  const list=$('handoffTimeline');list.replaceChildren();
  if(!recentTimeline.length){const li=document.createElement('li');li.className='timeline-empty';li.textContent=translateKey('timelineEmpty');list.append(li);return;}
  for(const event of recentTimeline){
    const item=document.createElement('li');item.className='timeline-item';
    const marker=document.createElement('span');marker.className='timeline-dot';marker.setAttribute('aria-hidden','true');
    const message=document.createElement('span');message.textContent=translateKey(`event_${event.type}`);
    const age=document.createElement('time');age.textContent=`${event.agoSeconds} ${translateKey('ago')}`;
    item.append(marker,message,age);list.append(item);
  }
}
function renderLocal(){value('enabledHint',prefs?.enabled===false?(prefs.locale==='zh-CN'?'已停用 · 设置仍保留':'Paused · settings kept'):(prefs?.locale==='zh-CN'?'已启用 · 需要你时显示当前步骤':'Enabled · shows the current step when needed'));renderHosts();renderTimeline();value('diagPermission',prefs?.accessibility?translateKey('enabled'):translateKey('disabled'));if(testLast)renderSelfTest(testLast);}
function showState(d){
 observedHosts=Array.isArray(d?.hosts)?d.hosts.slice(0,16):[];renderHosts();
 recentTimeline=Array.isArray(d?.timeline)?d.timeline.slice(-12):[];renderTimeline();
 const healthy=d?.broker==='running',desktop=d?.desktop==='present',hasHandoff=['awaiting_user','user_action_reported','observing'].includes(d?.session?.state);

 value('overviewTitle',translateKey(prefs?.enabled===false?'pausedTitle':!desktop?'offlineTitle':hasHandoff?'activeTitle':'welcome'));
 value('overviewDescription',translateKey(prefs?.enabled===false?'pausedDesc':!desktop?'offlineDesc':hasHandoff?'activeDesc':'welcomeDesc'));
 value('desktopState',desktop?translateKey('present'):translateKey('reconnecting'));
 value('handoffState',hasHandoff?translateKey(['verifying','next_step'].includes(d.session.phase)?'phase_'+d.session.phase:'waiting'):translateKey('idle'));
 value('agentActivity',d?.agentActivity==='recent'?translateKey('recent'):translateKey('noActivity'));
 value('diagBroker',healthy?translateKey('running'):translateKey('unavailable'));
 value('diagDesktop',desktop?translateKey('present'):translateKey('reconnecting'));
 value('diagAgent',d?.agentActivity==='recent'?translateKey('recent'):translateKey('noActivity'));
 value('diagSession',hasHandoff?translateKey(['verifying','next_step'].includes(d.session.phase)?'phase_'+d.session.phase:'waiting'):translateKey('idle'));
 value('diagDisplays',Number.isInteger(d?.displays)?String(d.displays):'—');
 value('refreshed',translateKey('moment'));
}
let toastTimeout;
function toast(message){const el=$('toast');document.querySelector(`[data-view="${currentPage}"]`).append(el);el.textContent=message;el.classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('visible'),5000);}
async function refresh(){const id=++serial;try{const r=await window.hgCenter.read();if(id!==serial)return;if(!r?.ok){value('refreshed',translateKey('unavailable'));return;}hostPlatform=r.platform;value('appVersion',r.appVersion?`v${r.appVersion}`:'—');if(!prefs||(!settingsDirty&&!busy)){
      prefs={...r.preferences,accessibility:r.accessibility};$('permission').hidden=r.platform!==undefined&&r.platform!=='darwin';
      for(const name of ['visualStyle','motion','theme','locale','density'])$(name).value=prefs[name];
      $('accessibility').checked=prefs.accessibility; $('enabled').checked=prefs.enabled!==false; $('continuous').checked=prefs.continuous!==false;
      applyLocale();
    }
    showState(r.diagnostics);}catch{if(id===serial)value('refreshed',translateKey('unavailable'));}}
let connectBusy=false;const connectResults={};
function connectionLabels(){const host=$('host').value,codex=host==='codex',workbuddy=host==='workbuddy';$('copy').textContent=translateKey(connectBusy?'connecting':codex?'connect':workbuddy?'prepareConnector':'copy');document.querySelector('[data-i="connectDesc"]').textContent=connectResults[host]?translateKey(connectResults[host]):codex?'':workbuddy?translateKey('workbuddyConnectHint'):translateKey('connectDesc');$('revealConnector').hidden=!(workbuddy&&connectResults[host]==='workbuddyPrepared');}
async function preview(){const id=++preview.seq;const host=$('host').value;connectionLabels();value('config',translateKey('loading'));value('configFormat',host==='codex'?'TOML':'JSON');try{const r=await window.hgCenter.preview(host);if(id!==preview.seq)return;value('config',r?.ok?r.content:translateKey('na'));$('copy').disabled=connectBusy||!r?.ok;}catch{if(id===preview.seq){value('config',translateKey('na'));$('copy').disabled=true;}}}
preview.seq=0;
function integrationLabel(state){return state==='installed'?'integrationInstalled':['modified','unmanaged'].includes(state)?'integrationModified':state==='bundle_ready'?'integrationBundleReady':'integrationNotInstalled';}
function renderIntegration(result){$('cleanupItems').replaceChildren();value('cleanupNote','');const node=$('integrationState');if(!result?.ok){node.textContent=translateKey('integrationUnsupported');node.dataset.state='unsupported';$('confirmCleanup').hidden=true;return;}const status=result.status||{};node.textContent=translateKey(integrationLabel(status.state));node.dataset.state=status.state||'unknown';$('confirmCleanup').hidden=true;}
async function inspectIntegration(){const host=$('host').value;try{const result=await window.hgCenter.lifecycleStatus(host);if(host!==$('host').value)return;renderIntegration(result);}catch{value('integrationState',translateKey('failed'));$('confirmCleanup').hidden=true;}}
document.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>showPage(button.dataset.page)));
function refreshPage(){void refresh();if(currentPage==='diagnostics')void refreshDisplays();}
 $('refresh').addEventListener('click',refreshPage);$('host').addEventListener('change',()=>{preview();inspectIntegration();});
$('copy').addEventListener('click',async()=>{
 const host=$('host').value;
 if(!['codex','workbuddy'].includes(host)){try{const r=await window.hgCenter.copy(host);toast(translateKey(r?.ok?'copied':'failed'));}catch{toast(translateKey('failed'));}return;}
 if(connectBusy)return;connectBusy=true;$('copy').disabled=true;connectionLabels();
 try{const r=await window.hgCenter.connect(host);connectResults[host]=r?.ok?(host==='codex'?'connectedRestart':'workbuddyPrepared'):(host==='codex'?'connectFailed':'workbuddyFailed');}catch{connectResults[host]=host==='codex'?'connectFailed':'workbuddyFailed';}
 finally{connectBusy=false;$('copy').disabled=false;connectionLabels();void inspectIntegration();}
});
$('revealConnector').addEventListener('click',async()=>{try{const r=await window.hgCenter.revealConnector();if(!r?.ok)toast(translateKey('failed'));}catch{toast(translateKey('failed'));}});
$('copyManual').addEventListener('click',async()=>{try{const r=await window.hgCenter.copy($('host').value);toast(translateKey(r?.ok?'copied':'failed'));}catch{toast(translateKey('failed'));}});
$('inspectIntegration').addEventListener('click',inspectIntegration);
function renderCleanup(plan){
 const list=$('cleanupItems');list.replaceChildren();
 const zh=prefs?.locale==='zh-CN';
 for(const item of plan.items||[]){const li=document.createElement('li');const title=document.createElement('span');title.textContent=(zh?{mcp_entry:'MCP 配置',skill:'引导技能',skill_resource:'技能参考',backup:'安装备份',installation_record:'安装记录',connector_file:'连接器文件'}:{mcp_entry:'MCP entry',skill:'Guidance Skill',skill_resource:'Skill reference',backup:'Installation backup',installation_record:'Installation record',connector_file:'Connector file'})[item.kind]||item.kind;const path=document.createElement('small');path.textContent=item.path;li.append(title,path);list.append(li);}
 value('cleanupNote',plan.host==='workbuddy'?(zh?'这里只清理本地连接器包。已导入的连接需在 WorkBuddy 中停用并移除。':'This removes the local bundle. Disable and remove the imported connector in WorkBuddy.'):(plan.retained?.length?(zh?'有修改过的内容，将予以保留。':'Edited content will be kept.'):(zh?'仅移除宿主连接。HandoffGlass 应用和外观设置仍保留。':'Removes the host connection. The HandoffGlass app and appearance settings are kept.')));
}
$('cleanupIntegration').addEventListener('click',async()=>{const host=$('host').value;try{const r=await window.hgCenter.cleanup(host,false);if(host!==$('host').value)return;if(!r?.ok)throw Error();renderCleanup(r.result);value('integrationState',translateKey(r.result.cleanupAvailable?'integrationCleanupReady':integrationLabel(r.result.state)));$('confirmCleanup').hidden=!r.result.cleanupAvailable;}catch{value('integrationState',translateKey('failed'));}});
$('confirmCleanup').addEventListener('click',async()=>{const button=$('confirmCleanup'),host=$('host').value;button.disabled=true;try{const r=await window.hgCenter.cleanup(host,true);if(host!==$('host').value)return;if(!r?.ok||!r.result.applied)throw Error();delete connectResults[host];$('integrationState').dataset.state=r.result.retained?.length?'modified':'not_installed';renderCleanup({...r.result,items:[]});value('integrationState',r.result.retained?.length?(prefs?.locale==='zh-CN'?'已移除未修改的内容，其余已保留。':'Unchanged content removed. Edited content was kept.'):r.result.host==='workbuddy'?(prefs?.locale==='zh-CN'?'本地连接器包已清理。':'Local connector bundle removed.'):translateKey('integrationCleanupDone'));button.hidden=true;await preview();}catch{value('integrationState',translateKey('failed'));}finally{button.disabled=false;}});
$('enabled').addEventListener('change',async()=>{if(!prefs)return;const node=$('enabled');node.disabled=true;try{const r=await window.hgCenter.setEnabled(node.checked);if(!r?.ok)throw Error();prefs.enabled=r.enabled;renderLocal();}catch{node.checked=prefs.enabled;toast(translateKey('failed'));}finally{node.disabled=false;}});
$('permission').addEventListener('click',async()=>{try{const r=await window.hgCenter.permission();if(!r?.ok)toast(translateKey('failed'));}catch{toast(translateKey('failed'));}});
$('preferences').addEventListener('change',event=>{if(!['visualStyle','motion','theme','locale','density'].includes(event.target.id))return;settingsDirty=true;document.documentElement.dataset.theme=$('theme').value;renderPreview();});
$('preferences').addEventListener('submit',async event=>{event.preventDefault();if(busy)return;busy=true;$('save').disabled=true;const requested={accessibility:$('accessibility').checked,enabled:$('enabled').checked,continuous:$('continuous').checked};for(const name of ['visualStyle','motion','theme','locale','density'])requested[name]=$(name).value;try{const r=await window.hgCenter.save(requested);if(!r?.ok)throw Error('save rejected');prefs={...r.preferences,accessibility:r.accessibility};settingsDirty=false;applyLocale();toast(translateKey('saved'));}catch{toast(translateKey('failed'));}finally{busy=false;$('save').disabled=false;}});
window.addEventListener('focus',refreshPage);
void refresh();setInterval(()=>{if(document.visibilityState==='visible'&&['overview','diagnostics'].includes(currentPage))void refresh();},8000);

function renderSelfTest(result){
  const good=result?.ok===true, timeout=result?.code==='timeout';
  const key=good?'selfTestPassed':timeout?'selfTestTimeout':result?.code==='already_running'?'selfTestBusy':'selfTestFailed';
  const node=$('testResult');node.textContent=translateKey(key);node.dataset.state=good?'pass':'fail';
  $('testHint').textContent=translateKey(good?'selfTestPassedHint':timeout?'selfTestTimeoutHint':'selfTestFailHint');
}
$('testMcp').addEventListener('click',async()=>{
  if(testBusy)return;testBusy=true;
  $('testMcp').disabled=true;$('testResult').textContent=translateKey('selfTestRunning');
  $('testResult').dataset.state='running';$('testHint').textContent='';
  try{testLast=await window.hgCenter.test();}catch{testLast={ok:false,code:'handshake_failed'};}
  renderSelfTest(testLast);testBusy=false;$('testMcp').disabled=false;
});
function createSvg(tag,attrs={},label=null){
  const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [key,val] of Object.entries(attrs))el.setAttribute(key,String(val));
  if(label!==null)el.textContent=label;
  return el;
}
let displaySerial=0;
async function refreshDisplays(){
  const serial=++displaySerial;
  let data;
  try{data=await window.hgCenter.displays();}catch{data=null;}
  if(serial!==displaySerial||currentPage!=='diagnostics')return;
  lastDisplays=data;renderDisplays(data);
}
function renderDisplays(data){
  value('displaySetupMode',translateKey(hostPlatform==='darwin'?'displaySetupMac':hostPlatform==='win32'?'displaySetupWindows':'displaySetupOther'));
  value('displaySettingsResult',displaySettingsState?translateKey(displaySettingsState):'');
  const svg=$('displayMap');svg.replaceChildren();
  const ds=Array.isArray(data?.displays)?data.displays.slice(0,16):[];
  const valid=ds.filter(d=>d?.bounds&&[d.bounds.x,d.bounds.y,d.bounds.width,d.bounds.height,d.scaleFactor].every(Number.isFinite)&&
      d.bounds.width>0&&d.bounds.height>0&&d.bounds.width<=20000&&d.bounds.height<=20000&&d.scaleFactor>0&&d.scaleFactor<=8);
  value('displayCount',data?.ok?translateKey(valid.length===1?'displayOne':'displayCount').replace('{count}',String(valid.length)):'—');
  if(!valid.length){value('displayNote',translateKey('displayNone'));value('layoutHealth',translateKey('layoutUnknown'));$('layoutHealth').dataset.state='warning';return;}
  const lowX=Math.min(...valid.map(d=>d.bounds.x)),lowY=Math.min(...valid.map(d=>d.bounds.y));
  const highX=Math.max(...valid.map(d=>d.bounds.x+d.bounds.width)),highY=Math.max(...valid.map(d=>d.bounds.y+d.bounds.height));
  const scale=Math.min(656/(highX-lowX),216/(highY-lowY));
  const baseX=(700-(highX-lowX)*scale)/2,baseY=(260-(highY-lowY)*scale)/2;
  for(const [i,d] of valid.entries()){
    const b=d.bounds,x=baseX+(b.x-lowX)*scale,y=baseY+(b.y-lowY)*scale;
    const w=b.width*scale,h=b.height*scale;
    const g=createSvg('g');
    g.append(createSvg('rect',{x,y,width:w,height:h,rx:8,class:'monitor-rect',...(d.primary?{'data-primary':'true'}:{})}));
    if(w>74&&h>56){
      g.append(createSvg('text',{x:x+11,y:y+22,class:'monitor-name'},`${translateKey('displayLabel')} ${i+1}`));
      g.append(createSvg('text',{x:x+11,y:y+39,class:'monitor-metadata'},`${b.x}, ${b.y} · ${d.scaleFactor}×`));
    }
    svg.append(g);
  }
  value('displayNote',translateKey('displayNote'));
  const status=data?.layoutCheck?.status;
  const label=status==='metadata_consistent'?'layoutConsistent':status==='inconsistent'?'layoutInconsistent':'layoutUnknown';
  value('layoutHealth',translateKey(label));
  $('layoutHealth').dataset.state=status==='metadata_consistent'?'consistent':'warning';
}
$('refreshDisplays').addEventListener('click',refreshDisplays);
$('displaySettings').addEventListener('click',async()=>{
  const button=$('displaySettings');if(button.disabled)return;button.disabled=true;
  const failure=hostPlatform==='darwin'?'displaySettingsMacFailed':hostPlatform==='win32'?'displaySettingsWindowsFailed':'displaySettingsFailed';
  try{const result=await window.hgCenter.displaySettings();displaySettingsState=result?.ok?'displaySettingsOpened':failure;}
  catch{displaySettingsState=failure;}
  finally{button.disabled=false;value('displaySettingsResult',translateKey(displaySettingsState));}
});

$('copyReport').addEventListener('click',async()=>{
  try{const result=await window.hgCenter.report(testLast?.code||'not_run');toast(translateKey(result?.ok?'reportCopied':'failed'));}
  catch{toast(translateKey('failed'));}
});

// The in-window preview shares the production renderer and motion rules.
let previewRevision=0;
function renderPreview(){
 if(currentPage!=='appearance')return;
 const svg=$('stylePreview'),bounds=svg.getBoundingClientRect(),target=document.querySelector('.preview-target').getBoundingClientRect();
 if(!bounds.width||!target.width)return;
 renderOverlay(svg,{sessionId:`settings-${previewRevision}`,visualStyle:$('visualStyle').value,motion:$('motion').value,
  annotations:[{id:'preview',x:target.x-bounds.x+target.width/2,y:target.y-bounds.y+target.height/2,width:target.width,height:target.height,shape:'ring',color:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()}]},
  {width:bounds.width,height:bounds.height});
}
$('replay').addEventListener('click',()=>{previewRevision++;renderPreview();});
new ResizeObserver(()=>renderPreview()).observe(document.querySelector('.style-preview'));
for(const switchId of ['accessibility','continuous'])$(switchId).addEventListener('change',async()=>{
 if(!prefs)return;
 const requested=$('accessibility').checked;for(const id of ['accessibility','continuous'])$(id).disabled=true;
 try{const result=await window.hgCenter.save({visualStyle:prefs.visualStyle,motion:prefs.motion,theme:prefs.theme,locale:prefs.locale,density:prefs.density,enabled:$('enabled').checked,continuous:$('continuous').checked,accessibility:requested});if(!result?.ok)throw Error();prefs={...result.preferences,accessibility:result.accessibility};renderLocal();}
 catch{$('accessibility').checked=prefs.accessibility;$('continuous').checked=prefs.continuous;toast(translateKey('failed'));}
 finally{for(const id of ['accessibility','continuous'])$(id).disabled=false;}
});
