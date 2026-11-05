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
 if(!s||s.helper==='unavailable'||s.osPermission==='unavailable')return zh?'定位组件暂不可用，可以先用文字引导。':'Control lookup is unavailable. Text guidance is available.';
 if(!s.localConsent)return zh?'尚未允许控件定位。开启后可检查系统权限。':'Control lookup is off. Enable it to check system access.';
 if(s.osPermission==='denied')return zh?'系统尚未允许辅助功能访问。请在系统设置中开启。':'System Accessibility access is not granted. Enable it in settings.';
 if(['granted','available'].includes(s.osPermission))return zh?'控件定位已就绪。':'Control lookup is ready.';
 return zh?'系统权限待检查。':'System access has not been checked.';
}
