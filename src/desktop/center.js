'use strict';
const lex = {
 'zh-CN': {
  overview:'概览',connections:'Agent 连接',appearance:'外观与动态',diagnostics:'运行诊断',local:'本机运行 · 不上传内容',refresh:'刷新',workspace:'LOCAL WORKSPACE',welcome:'你的 Agent，随时接得上。',welcomeDesc:'在这里查看本地交接状态。需要你操作时，桌面引导会自动出现。',hero:'让下一步清晰可见。',heroDesc:'Agent 发起 · 本地引导 · 你来决定 · Agent 继续',brokerTitle:'本地服务',brokerDesc:'仅在这台设备运行',desktopTitle:'桌面引导',desktopDesc:'等待屏幕服务反馈',handoffTitle:'当前交接',handoffDesc:'没有正在等待的操作',activityTitle:'最近 Agent 活动',activityDesc:'只记录是否收到本地请求，不保存会话正文。',connectLabel:'02 / CONNECT',connectTitle:'连接你的 Agent。',connectDesc:'为当前设备生成配置。复制到宿主软件的 MCP 设置，重新加载工具即可。',host:'选择 Agent / Harness',localConfig:'本机 MCP 配置',configHint:'由当前安装位置生成。移动应用后请重新复制。',copy:'复制配置',connectNote:'这里只能观测本机 MCP 请求；无法直接验证外部宿主是否已加载工具。请在 Agent 中确认工具列表。',styleLabel:'03 / PERSONALIZE',styleTitle:'按自己的方式工作。',styleDesc:'外观偏好仅保存在本机，所有 Agent 共享。你选定的设置不会被 Agent 覆盖。',visual:'视觉风格',motion:'动画',theme:'主题',language:'语言',density:'信息密度',inspect:'允许只读 UI 控件定位',inspectDesc:'仅在 Agent 请求时读取当前前台应用的控件位置。默认关闭。',openPermission:'打开系统辅助功能设置',save:'保存设置',healthLabel:'04 / RUNTIME',healthTitle:'运行诊断。',healthDesc:'显示本地服务当前能够确认的状态，不读取屏幕内容。',checkBroker:'本地 Broker',checkDesktop:'桌面服务',checkAgent:'最近 MCP 请求',checkDisplays:'检测到的显示器',checkSession:'人工交接',checkPermission:'只读控件定位',healthFoot:'此页不能证明某个宿主客户端已经成功安装，也不能替代真实桌面的鼠标穿透与多显示器验收。',running:'运行中',reconnecting:'重连中',present:'已连接',idle:'空闲',waiting:'等待用户',recent:'近 2 分钟有请求',noActivity:'未观测到近期请求',enabled:'已允许',disabled:'已关闭',unavailable:'状态暂不可用',saved:'设置已保存',copied:'配置已复制',failed:'操作未完成',moment:'刚刚更新',loading:'正在连接本地服务…',na:'不可用',selfTestTitle:'本机 MCP 自检',selfTestDesc:'在隔离环境中验证 MCP 握手、工具发现与只读屏幕查询。',selfTestRun:'开始检测',selfTestRunning:'正在检查本地协议…',selfTestPassed:'本机 MCP 可用',selfTestPassedHint:'已完成隔离握手与工具检查。请在宿主 Agent 的工具列表中确认 HandoffGlass。',selfTestFailed:'本机 MCP 检测失败',selfTestFailHint:'请检查安装依赖、应用位置，再重新检测。若仍失败，请运行 npm run readiness。',selfTestTimeout:'服务启动超时',selfTestTimeoutHint:'检查安全软件是否阻止子进程；重启 HandoffGlass 后重试。',selfTestBusy:'另一项检测正在进行',displayTitle:'显示器布局',displaySubtitle:'全局 DIP 坐标 · 不截屏',displayNone:'未检测到可用的显示器几何。',displayNote:'此图显示位置与缩放关系，不代表真实控件定位精度。',displayLabel:'显示器',reportTitle:'脱敏诊断报告',reportDesc:'复制协议检测结果，不包含密钥、任务文本或屏幕内容。',reportCopy:'复制报告',reportCopied:'报告已复制',observedHostsTitle:'实际调用记录',observedHostsDesc:'Agent 使用 MCP 工具后，会留下不含任务内容的临时记录。',evidenceLive:'仅本机 · 15 分钟',evidenceEmpty:'暂无已观测到的 MCP 工具调用',evidenceDisclaimer:'宿主名称由 MCP 启动配置声明，并非经过认证的宿主身份。这里不保留任务、账户或会话正文。',ago:'秒前',calls:'次调用',unknownHost:'未标识的 MCP 客户端',layoutConsistent:'显示器元数据检查通过 · 尚未验证实际控件精度',layoutInconsistent:'检测到显示器坐标或缩放异常，请重新连接显示器并重试',layoutUnknown:'无法验证当前显示器布局',timelineTitle:'交接事件',timelineDesc:'定位与人工反馈的状态变化。没有文本或坐标。',timelineLocal:'本机 · 临时',timelineEmpty:'暂无交接事件',event_started:'交接请求已创建',event_target_acquired:'开始跟随目标',event_target_moved:'目标位置已更新',event_target_lost:'目标已失效 · 标注隐藏',event_target_restored:'目标已恢复 · 标注重现',event_display_changed:'显示器布局变化',event_desktop_unavailable:'桌面服务暂不可用',event_scene_changed:'图层由 Agent 更新',event_tracking_released:'Agent 接管图层',event_completed:'用户报告完成 · 待独立验证',event_declined:'用户拒绝',event_cancelled:'交接已取消',event_expired:'交接已超时',event_superseded:'已被新交接替换'
 },
 'en-US': {
  overview:'Overview',connections:'Agent connections',appearance:'Appearance',diagnostics:'Diagnostics',local:'PRIVATE · ON DEVICE',refresh:'Refresh',workspace:'LOCAL WORKSPACE',welcome:'Your agents, within reach.',welcomeDesc:'See the local handoff state. Guidance appears on your desktop when you need to step in.',hero:'Make the next step visible.',heroDesc:'Agent requests · Local guidance · You decide · Agent resumes',brokerTitle:'Local broker',brokerDesc:'Runs only on this device',desktopTitle:'Desktop guidance',desktopDesc:'Live screen runtime',handoffTitle:'Current handoff',handoffDesc:'No action awaiting your response',activityTitle:'Recent agent activity',activityDesc:'Tracks only local API activity, not task content.',connectLabel:'02 / CONNECT',connectTitle:'Connect an agent.',connectDesc:'Generate a configuration for this device, paste it into your host MCP settings and reload tools.',host:'Agent / Harness',localConfig:'Local MCP configuration',configHint:'Generated for this installation path. Copy again if the app is moved.',copy:'Copy configuration',connectNote:'Local activity cannot prove an external host loaded the tools. Verify tool discovery in the host.',styleLabel:'03 / PERSONALIZE',styleTitle:'Make it your own.',styleDesc:'Preferences stay on this device and are shared across agents. Agents cannot override your choices.',visual:'Visual style',motion:'Motion',theme:'Theme',language:'Language',density:'Information density',inspect:'Allow read-only UI lookup',inspectDesc:'Reads foreground UI control positions only when an agent asks. Off by default.',openPermission:'Open Accessibility settings',save:'Save changes',healthLabel:'04 / RUNTIME',healthTitle:'Runtime diagnostics.',healthDesc:'Observations available from the local service, without reading your screen.',checkBroker:'Local broker',checkDesktop:'Desktop runtime',checkAgent:'Recent MCP calls',checkDisplays:'Detected displays',checkSession:'Human handoff',checkPermission:'Read-only UI lookup',healthFoot:'This view cannot certify installation in a particular host or substitute for physical click-through and multi-monitor testing.',running:'Running',reconnecting:'Reconnecting',present:'Present',idle:'Idle',waiting:'Awaiting human',recent:'Request seen in last 2 min',noActivity:'No recent requests observed',enabled:'Enabled',disabled:'Disabled',unavailable:'Unavailable',saved:'Changes saved',copied:'Configuration copied',failed:'Could not complete the action',moment:'Updated just now',loading:'Connecting to local service…',na:'Unavailable',selfTestTitle:'Local MCP self-test',selfTestDesc:'Verify the MCP handshake, tool discovery and read-only screen query in isolation.',selfTestRun:'Run self-test',selfTestRunning:'Checking local protocol…',selfTestPassed:'Local MCP is ready',selfTestPassedHint:'Isolated handshake and tools passed. Confirm HandoffGlass is listed in your agent’s tools.',selfTestFailed:'Local MCP test failed',selfTestFailHint:'Check installation dependencies and app location, then retry. Run npm run readiness if the issue persists.',selfTestTimeout:'Service start timed out',selfTestTimeoutHint:'Check whether endpoint security blocked a child process. Restart HandoffGlass and retry.',selfTestBusy:'Another test is running',displayTitle:'Display layout',displaySubtitle:'Global DIP coordinates · No capture',displayNone:'No usable display geometry detected.',displayNote:'This view shows relative positions and scaling, not verified UI target accuracy.',displayLabel:'Display',reportTitle:'Private diagnostic report',reportDesc:'Copy protocol test results without credentials, task text or screen content.',reportCopy:'Copy report',reportCopied:'Report copied',observedHostsTitle:'Observed tool calls',observedHostsDesc:'A short-lived trace appears only after an MCP client actually calls a tool.',evidenceLive:'On device · 15 minutes',evidenceEmpty:'No MCP tool calls observed yet',evidenceDisclaimer:'Host labels are declared by the launching MCP configuration, not independently authenticated. No task, account or session text is retained.',ago:'seconds ago',calls:'calls',unknownHost:'Unidentified MCP client',layoutConsistent:'Display metadata looks consistent · Real target accuracy is not verified',layoutInconsistent:'Display geometry or scale mismatch; reconnect displays and retry',layoutUnknown:'Display layout cannot be evaluated',timelineTitle:'Handoff events',timelineDesc:'Local position and decision transitions without task text or coordinates.',timelineLocal:'On device · Ephemeral',timelineEmpty:'No handoff events yet',event_started:'Handoff request created',event_target_acquired:'Target tracking started',event_target_moved:'Target position updated',event_target_lost:'Target lost · Highlight hidden',event_target_restored:'Target restored · Highlight visible',event_display_changed:'Display layout changed',event_desktop_unavailable:'Desktop unavailable',event_scene_changed:'Agent updated scene',event_tracking_released:'Agent took over scene',event_completed:'Human reported done · Verify independently',event_declined:'Human declined',event_cancelled:'Handoff cancelled',event_expired:'Handoff expired',event_superseded:'Superseded by new handoff'
 }
};
const $=id=>document.getElementById(id);
let prefs=null,currentPage='overview',busy=false,serial=0,settingsDirty=false,testBusy=false,testLast=null;
const translateKey=key=>(lex[prefs?.locale]||lex['zh-CN'])[key]||key;
function applyLocale(){const lang=lex[prefs?.locale]?prefs.locale:'zh-CN';document.documentElement.lang=lang;document.documentElement.dataset.theme=prefs?.theme||'system';document.querySelectorAll('[data-i]').forEach(el=>{el.textContent=translateKey(el.dataset.i)});renderLocal();}
function showPage(page){if(!['overview','connections','appearance','diagnostics'].includes(page))return;currentPage=page;document.querySelectorAll('[data-view]').forEach(el=>el.hidden=el.dataset.view!==page);document.querySelectorAll('[data-page]').forEach(el=>el.getAttribute('data-page')===page?el.setAttribute('aria-current','page'):el.removeAttribute('aria-current'));$('crumb').textContent=page.toUpperCase();if(page==='connections'){void preview();void refresh();}if(page==='diagnostics'||page==='overview')void refresh();if(page==='diagnostics')void refreshDisplays();}
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
async function refresh(){const id=++serial;try{const r=await window.hgCenter.read();if(id!==serial)return;if(!r?.ok){value('refreshed',translateKey('unavailable'));return;}value('appVersion',r.appVersion?`v${r.appVersion}`:'—');if(!prefs||(!settingsDirty&&!busy)){
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
