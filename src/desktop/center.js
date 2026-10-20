'use strict';
import { renderOverlay } from './overlay-renderer.mjs';
const lex = {
 "zh-CN": {
  "overview": "引导",
  "connections": "连接",
  "appearance": "外观",
  "diagnostics": "帮助",
  "refresh": "刷新",
  "welcome": "等待下一步",
  "welcomeDesc": "从 Codex 发起任务，需要你时，引导会出现在桌面。",
  "manageConnection": "管理连接",
  "desktopTitle": "桌面引导",
  "handoffTitle": "当前操作",
  "activityTitle": "最近连接",
  "connectTitle": "连接",
  "connectDesc": "将配置添加到应用，重新连接工具。",
  "host": "应用",
  "localConfig": "查看配置",
  "copy": "复制配置",
  "styleTitle": "外观",
  "visual": "标注",
  "motion": "动态",
  "theme": "主题",
  "language": "语言",
  "density": "间距",
  "inspect": "允许定位屏幕控件",
  "inspectDesc": "定位需要辅助功能权限。",
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
  "displayTitle": "显示器",
  "displayNone": "未检测到显示器",
  "displayNote": "",
  "displayLabel": "显示器",
  "reportCopy": "复制诊断信息",
  "reportCopied": "已复制",
  "observedHostsTitle": "最近连接",
  "evidenceEmpty": "暂无连接记录",
  "ago": "秒前",
  "calls": "次请求",
  "unknownHost": "其他应用",
  "layoutConsistent": "布局正常",
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
  "host": "App",
  "localConfig": "View configuration",
  "copy": "Copy configuration",
  "styleTitle": "Appearance",
  "visual": "Marks",
  "motion": "Motion",
  "theme": "Theme",
  "language": "Language",
  "density": "Spacing",
  "inspect": "Allow screen element lookup",
  "inspectDesc": "Element lookup requires Accessibility permission.",
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
  "displayNote": "",
  "displayLabel": "Display",
  "reportCopy": "Copy diagnostics",
  "reportCopied": "Copied",
  "observedHostsTitle": "Recent connections",
  "evidenceEmpty": "No connections recorded",
  "ago": "seconds ago",
  "calls": "requests",
  "unknownHost": "Other app",
  "layoutConsistent": "Layout ready",
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
let prefs=null,currentPage='overview',busy=false,serial=0,settingsDirty=false,testBusy=false,testLast=null;
const translateKey=key=>(lex[prefs?.locale]||lex['zh-CN'])[key]||key;
function applyLocale(){const lang=lex[prefs?.locale]?prefs.locale:'zh-CN';document.documentElement.lang=lang;document.documentElement.dataset.theme=prefs?.theme||'system';document.querySelectorAll('[data-i]').forEach(el=>{el.textContent=translateKey(el.dataset.i)});document.querySelectorAll('[data-option]').forEach(el=>{el.textContent=translateKey(el.dataset.option)});document.querySelectorAll('[data-label]').forEach(el=>el.setAttribute('aria-label',translateKey(el.dataset.label)));$('crumb').textContent=translateKey(currentPage);renderLocal();}
function showPage(page){if(!['overview','connections','appearance','diagnostics'].includes(page))return;currentPage=page;document.querySelectorAll('[data-view]').forEach(el=>el.hidden=el.dataset.view!==page);document.querySelectorAll('[data-page]').forEach(el=>el.getAttribute('data-page')===page?el.setAttribute('aria-current','page'):el.removeAttribute('aria-current'));$('crumb').textContent=translateKey(page);if(page==='connections'){void preview();void refresh();}if(page==='diagnostics'||page==='overview')void refresh();if(page==='diagnostics')void refreshDisplays();if(page==='appearance')requestAnimationFrame(renderPreview);}
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
function renderLocal(){renderHosts();renderTimeline();value('diagPermission',prefs?.accessibility?translateKey('enabled'):translateKey('disabled'));if(testLast)renderSelfTest(testLast);}
function showState(d){
 observedHosts=Array.isArray(d?.hosts)?d.hosts.slice(0,16):[];renderHosts();
 recentTimeline=Array.isArray(d?.timeline)?d.timeline.slice(-12):[];renderTimeline();
 const healthy=d?.broker==='running',desktop=d?.desktop==='present',hasHandoff=d?.session?.state==='awaiting_user';

 value('overviewTitle',translateKey(!desktop?'offlineTitle':hasHandoff?'activeTitle':'welcome'));
 value('overviewDescription',translateKey(!desktop?'offlineDesc':hasHandoff?'activeDesc':'welcomeDesc'));
 value('desktopState',desktop?translateKey('present'):translateKey('reconnecting'));
 value('handoffState',hasHandoff?translateKey('waiting'):translateKey('idle'));
 value('agentActivity',d?.agentActivity==='recent'?translateKey('recent'):translateKey('noActivity'));
 value('diagBroker',healthy?translateKey('running'):translateKey('unavailable'));
 value('diagDesktop',desktop?translateKey('present'):translateKey('reconnecting'));
 value('diagAgent',d?.agentActivity==='recent'?translateKey('recent'):translateKey('noActivity'));
 value('diagSession',hasHandoff?translateKey('waiting'):translateKey('idle'));
 value('diagDisplays',Number.isInteger(d?.displays)?String(d.displays):'—');
 value('refreshed',translateKey('moment'));
}
let toastTimeout;
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('visible'),2800);}
async function refresh(){const id=++serial;try{const r=await window.hgCenter.read();if(id!==serial)return;if(!r?.ok){value('refreshed',translateKey('unavailable'));return;}value('appVersion',r.appVersion?`v${r.appVersion}`:'—');if(!prefs||(!settingsDirty&&!busy)){
      prefs={...r.preferences,accessibility:r.accessibility};$('permission').hidden=r.platform!==undefined&&r.platform!=='darwin';
      for(const name of ['visualStyle','motion','theme','locale','density'])$(name).value=prefs[name];
      $('accessibility').checked=prefs.accessibility;
      applyLocale();
    }
    showState(r.diagnostics);}catch{if(id===serial)value('refreshed',translateKey('unavailable'));}}
async function preview(){const id=++preview.seq;const host=$('host').value;value('config',translateKey('loading'));value('configFormat',host==='codex'?'TOML':'JSON');try{const r=await window.hgCenter.preview(host);if(id!==preview.seq)return;value('config',r?.ok?r.content:translateKey('na'));$('copy').disabled=!r?.ok;}catch{if(id===preview.seq){value('config',translateKey('na'));$('copy').disabled=true;}}}
preview.seq=0;
document.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>showPage(button.dataset.page)));
$('refresh').addEventListener('click',refresh);$('host').addEventListener('change',preview);
$('copy').addEventListener('click',async()=>{try{const r=await window.hgCenter.copy($('host').value);toast(translateKey(r?.ok?'copied':'failed'));}catch{toast(translateKey('failed'));}});
$('permission').addEventListener('click',async()=>{try{const r=await window.hgCenter.permission();if(!r?.ok)toast(translateKey('failed'));}catch{toast(translateKey('failed'));}});
$('preferences').addEventListener('change',()=>{settingsDirty=true;document.documentElement.dataset.theme=$('theme').value;renderPreview();});
$('preferences').addEventListener('submit',async event=>{event.preventDefault();if(busy)return;busy=true;$('save').disabled=true;const requested={accessibility:$('accessibility').checked};for(const name of ['visualStyle','motion','theme','locale','density'])requested[name]=$(name).value;try{const r=await window.hgCenter.save(requested);if(!r?.ok)throw Error('save rejected');prefs={...r.preferences,accessibility:r.accessibility};settingsDirty=false;applyLocale();toast(translateKey('saved'));}catch{toast(translateKey('failed'));}finally{busy=false;$('save').disabled=false;}});
window.addEventListener('focus',refresh);
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
  const svg=$('displayMap');svg.replaceChildren();
  const ds=Array.isArray(data?.displays)?data.displays.slice(0,16):[];
  const valid=ds.filter(d=>d?.bounds&&[d.bounds.x,d.bounds.y,d.bounds.width,d.bounds.height,d.scaleFactor].every(Number.isFinite)&&
      d.bounds.width>0&&d.bounds.height>0&&d.bounds.width<=20000&&d.bounds.height<=20000&&d.scaleFactor>0&&d.scaleFactor<=8);
  if(!valid.length){value('displayNote',translateKey('displayNone'));value('layoutHealth',translateKey('layoutUnknown'));return;}
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
$('accessibility').addEventListener('change',async()=>{
 if(!prefs)return;
 const requested=$('accessibility').checked;$('accessibility').disabled=true;
 try{const result=await window.hgCenter.save({visualStyle:prefs.visualStyle,motion:prefs.motion,theme:prefs.theme,locale:prefs.locale,density:prefs.density,accessibility:requested});if(!result?.ok)throw Error();prefs.accessibility=result.accessibility;renderLocal();}
 catch{$('accessibility').checked=prefs.accessibility;toast(translateKey('failed'));}
 finally{$('accessibility').disabled=false;}
});
