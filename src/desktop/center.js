'use strict';
const lex = {
 'zh-CN': {
  overview:'概览',connections:'Agent 连接',appearance:'外观与动态',diagnostics:'运行诊断',local:'本机运行 · 不上传内容',refresh:'刷新',workspace:'LOCAL WORKSPACE',welcome:'你的 Agent，随时接得上。',welcomeDesc:'在这里查看本地交接状态。需要你操作时，桌面引导会自动出现。',hero:'让下一步清晰可见。',heroDesc:'Agent 发起 · 本地引导 · 你来决定 · Agent 继续',brokerTitle:'本地服务',brokerDesc:'仅在这台设备运行',desktopTitle:'桌面引导',desktopDesc:'等待屏幕服务反馈',handoffTitle:'当前交接',handoffDesc:'没有正在等待的操作',activityTitle:'最近 Agent 活动',activityDesc:'只记录是否收到本地请求，不保存会话正文。',connectLabel:'02 / CONNECT',connectTitle:'连接你的 Agent。',connectDesc:'为当前设备生成配置。复制到宿主软件的 MCP 设置，重新加载工具即可。',host:'选择 Agent / Harness',localConfig:'本机 MCP 配置',configHint:'由当前安装位置生成。移动应用后请重新复制。',copy:'复制配置',connectNote:'这里只能观测本机 MCP 请求；无法直接验证外部宿主是否已加载工具。请在 Agent 中确认工具列表。',styleLabel:'03 / PERSONALIZE',styleTitle:'按自己的方式工作。',styleDesc:'外观偏好仅保存在本机，所有 Agent 共享。你选定的设置不会被 Agent 覆盖。',visual:'视觉风格',motion:'动画',theme:'主题',language:'语言',density:'信息密度',inspect:'允许只读 UI 控件定位',inspectDesc:'仅在 Agent 请求时读取当前前台应用的控件位置。默认关闭。',openPermission:'打开系统辅助功能设置',save:'保存设置',healthLabel:'04 / RUNTIME',healthTitle:'运行诊断。',healthDesc:'显示本地服务当前能够确认的状态，不读取屏幕内容。',checkBroker:'本地 Broker',checkDesktop:'桌面服务',checkAgent:'最近 MCP 请求',checkDisplays:'检测到的显示器',checkSession:'人工交接',checkPermission:'只读控件定位',healthFoot:'此页不能证明某个宿主客户端已经成功安装，也不能替代真实桌面的鼠标穿透与多显示器验收。',running:'运行中',reconnecting:'重连中',present:'已连接',idle:'空闲',waiting:'等待用户',recent:'近 2 分钟有请求',noActivity:'未观测到近期请求',enabled:'已允许',disabled:'已关闭',unavailable:'状态暂不可用',saved:'设置已保存',copied:'配置已复制',failed:'操作未完成',moment:'刚刚更新',loading:'正在连接本地服务…',na:'不可用'
 },
 'en-US': {
  overview:'Overview',connections:'Agent connections',appearance:'Appearance',diagnostics:'Diagnostics',local:'PRIVATE · ON DEVICE',refresh:'Refresh',workspace:'LOCAL WORKSPACE',welcome:'Your agents, within reach.',welcomeDesc:'See the local handoff state. Guidance appears on your desktop when you need to step in.',hero:'Make the next step visible.',heroDesc:'Agent requests · Local guidance · You decide · Agent resumes',brokerTitle:'Local broker',brokerDesc:'Runs only on this device',desktopTitle:'Desktop guidance',desktopDesc:'Live screen runtime',handoffTitle:'Current handoff',handoffDesc:'No action awaiting your response',activityTitle:'Recent agent activity',activityDesc:'Tracks only local API activity, not task content.',connectLabel:'02 / CONNECT',connectTitle:'Connect an agent.',connectDesc:'Generate a configuration for this device, paste it into your host MCP settings and reload tools.',host:'Agent / Harness',localConfig:'Local MCP configuration',configHint:'Generated for this installation path. Copy again if the app is moved.',copy:'Copy configuration',connectNote:'Local activity cannot prove an external host loaded the tools. Verify tool discovery in the host.',styleLabel:'03 / PERSONALIZE',styleTitle:'Make it your own.',styleDesc:'Preferences stay on this device and are shared across agents. Agents cannot override your choices.',visual:'Visual style',motion:'Motion',theme:'Theme',language:'Language',density:'Information density',inspect:'Allow read-only UI lookup',inspectDesc:'Reads foreground UI control positions only when an agent asks. Off by default.',openPermission:'Open Accessibility settings',save:'Save changes',healthLabel:'04 / RUNTIME',healthTitle:'Runtime diagnostics.',healthDesc:'Observations available from the local service, without reading your screen.',checkBroker:'Local broker',checkDesktop:'Desktop runtime',checkAgent:'Recent MCP calls',checkDisplays:'Detected displays',checkSession:'Human handoff',checkPermission:'Read-only UI lookup',healthFoot:'This view cannot certify installation in a particular host or substitute for physical click-through and multi-monitor testing.',running:'Running',reconnecting:'Reconnecting',present:'Present',idle:'Idle',waiting:'Awaiting human',recent:'Request seen in last 2 min',noActivity:'No recent requests observed',enabled:'Enabled',disabled:'Disabled',unavailable:'Unavailable',saved:'Changes saved',copied:'Configuration copied',failed:'Could not complete the action',moment:'Updated just now',loading:'Connecting to local service…',na:'Unavailable'
 }
};
const $=id=>document.getElementById(id);
let prefs=null,currentPage='overview',busy=false,serial=0,settingsDirty=false;
const translateKey=key=>(lex[prefs?.locale]||lex['zh-CN'])[key]||key;
function applyLocale(){const lang=lex[prefs?.locale]?prefs.locale:'zh-CN';document.documentElement.lang=lang;document.documentElement.dataset.theme=prefs?.theme||'system';document.querySelectorAll('[data-i]').forEach(el=>{el.textContent=translateKey(el.dataset.i)});renderLocal();}
function showPage(page){if(!['overview','connections','appearance','diagnostics'].includes(page))return;currentPage=page;document.querySelectorAll('[data-view]').forEach(el=>el.hidden=el.dataset.view!==page);document.querySelectorAll('[data-page]').forEach(el=>el.getAttribute('data-page')===page?el.setAttribute('aria-current','page'):el.removeAttribute('aria-current'));$('crumb').textContent=page.toUpperCase();if(page==='connections')void preview();if(page==='diagnostics'||page==='overview')void refresh();}
function value(id,text){$(id).textContent=text;}
function renderLocal(){value('diagPermission',prefs?.accessibility?translateKey('enabled'):translateKey('disabled'));}
function showState(d){
 const healthy=d?.broker==='running',desktop=d?.desktop==='present',hasHandoff=d?.session?.state==='awaiting_user';
 value('brokerState',healthy?translateKey('running'):translateKey('unavailable'));
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
async function refresh(){const id=++serial;try{const r=await window.hgCenter.read();if(id!==serial)return;if(!r?.ok){value('refreshed',translateKey('unavailable'));return;}if(!prefs||(!settingsDirty&&!busy)){
      prefs={...r.preferences,accessibility:r.accessibility};
      for(const name of ['visualStyle','motion','theme','locale','density'])$(name).value=prefs[name];
      $('accessibility').checked=prefs.accessibility;
      applyLocale();
    }
    showState(r.diagnostics);}catch{if(id===serial)value('refreshed',translateKey('unavailable'));}}
async function preview(){const id=++preview.seq;const host=$('host').value;value('config',translateKey('loading'));value('configFormat',host==='codex'?'TOML / MCP':'JSON / MCP');try{const r=await window.hgCenter.preview(host);if(id!==preview.seq)return;value('config',r?.ok?r.content:translateKey('na'));$('copy').disabled=!r?.ok;}catch{if(id===preview.seq){value('config',translateKey('na'));$('copy').disabled=true;}}}
preview.seq=0;
document.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>showPage(button.dataset.page)));
$('refresh').addEventListener('click',refresh);$('host').addEventListener('change',preview);
$('copy').addEventListener('click',async()=>{try{const r=await window.hgCenter.copy($('host').value);toast(translateKey(r?.ok?'copied':'failed'));}catch{toast(translateKey('failed'));}});
$('permission').addEventListener('click',async()=>{try{const r=await window.hgCenter.permission();if(!r?.ok)toast(r?.error||translateKey('failed'));}catch{toast(translateKey('failed'));}});
$('preferences').addEventListener('change',()=>{settingsDirty=true;});
$('preferences').addEventListener('submit',async event=>{event.preventDefault();if(busy)return;busy=true;$('save').disabled=true;const requested={accessibility:$('accessibility').checked};for(const name of ['visualStyle','motion','theme','locale','density'])requested[name]=$(name).value;try{const r=await window.hgCenter.save(requested);if(!r?.ok)throw Error('save rejected');prefs={...r.preferences,accessibility:r.accessibility};settingsDirty=false;applyLocale();toast(translateKey('saved'));}catch{toast(translateKey('failed'));}finally{busy=false;$('save').disabled=false;}});
window.addEventListener('focus',refresh);
void refresh();setInterval(()=>{if(document.visibilityState==='visible'&&['overview','diagnostics'].includes(currentPage))void refresh();},8000);
