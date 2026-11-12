/** Shared, factual connection progress. Unknown host states stay unknown. */
const LABELS={
 'zh-CN':{detect:'检测环境',write:'写入配置与技能',trust:'信任并启用',reload:'重新加载应用',tools:'工具可见',call:'首次调用',complete:'已完成',pending:'待完成',unknown:'待确认',blocked:'需处理'},
 'en-US':{detect:'Environment',write:'Configuration and Skill',trust:'Trust and enable',reload:'Reload the app',tools:'Tools available',call:'First real call',complete:'Complete',pending:'Pending',unknown:'Not confirmed',blocked:'Needs attention'}
};
export function renderConnectionSteps(node,result,locale='zh-CN'){
 const labels=LABELS[locale]||LABELS['en-US'];node.replaceChildren();
 for(const [i,item] of (result?.steps||[]).entries()){
  const row=document.createElement('li');row.dataset.state=item.state||'unknown';
  const number=document.createElement('span');number.className='connection-number';number.textContent=item.state==='complete'?'✓':String(i+1);number.setAttribute('aria-hidden','true');
  const name=document.createElement('span');name.textContent=labels[item.id]||item.id;
  const state=document.createElement('small');state.textContent=labels[item.state]||labels.unknown;
  row.append(number,name,state);node.append(row);
 }
}
export function permissionLabel(result,locale='zh-CN'){
 const zh=locale==='zh-CN',s=result?.status||result;
 if(!s||s.helper==='unavailable'||s.osPermission==='unavailable')return zh?'原生定位暂不可用，仍可使用宿主观察绘制标记。':'Native lookup is unavailable. Host-observed drawing is available.';
 if(!s.localConsent)return zh?'原生定位未开启，不影响宿主观察和屏幕绘制。':'Native lookup is off. Host observation and drawing are available.';
 if(s.osPermission==='denied')return zh?'原生定位缺少辅助功能权限；屏幕绘制可继续使用。':'Native lookup needs Accessibility access. Screen drawing remains available.';
 if(['granted','available'].includes(s.osPermission))return zh?'控件定位已就绪。':'Control lookup is ready.';
 return zh?'系统权限待检查。':'System access has not been checked.';
}
