import { renderOverlay } from './overlay-renderer.mjs';
/** Small local radio groups. Native values remain form-backed and never open a menu. */
export function upgradeChoices(root=document){
  for(const select of root.querySelectorAll('select')){
    if(select.dataset.upgraded)continue;select.dataset.upgraded='true';select.hidden=true;
    let field=select.parentElement;
    if(field.tagName==='LABEL'){
      const div=document.createElement('div');div.className=field.className;
      field.replaceWith(div);div.append(...field.childNodes);field=div;
    }
    const group=document.createElement('div');group.className=select.id==='host'?'choice-group host-choices':select.id==='visualStyle'?'choice-group style-choices':'choice-group segments';
    group.setAttribute('role','radiogroup');
    const buttons=[];
    let more;
    if(select.id==='host'){
      more=document.createElement('details');more.className='other-hosts';
      const summary=document.createElement('summary');more.append(summary);
      const others=document.createElement('div');others.className='other-host-grid';more.append(others);group.append(more);
    }
    for(const option of select.options){
      const button=document.createElement('button');button.type='button';button.className='choice';button.dataset.value=option.value;button.setAttribute('role','radio');
      if(select.id==='visualStyle'){
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 44');svg.setAttribute('aria-hidden','true');
        renderOverlay(svg,{sessionId:'choice-'+option.value,visualStyle:option.value,motion:'off',annotations:[{id:'sample',x:50,y:22,width:46,height:22,shape:'ring',color:'#5c9278'}]},{width:100,height:44});button.append(svg);
      }
      if(select.id==='host' && ['codex','workbuddy'].includes(option.value)){
        const icon=document.createElement('span');icon.className='host-icon';icon.textContent=option.value==='codex'?'C':'W';icon.setAttribute('aria-hidden','true');button.append(icon);
      }
      const label=document.createElement('span');label.className='choice-label';button.append(label);
      if(more && !['codex','workbuddy'].includes(option.value))more.lastChild.append(button);else group.insertBefore(button,more||null);
      button.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();});
      buttons.push(button);
    }
    const sync=()=>{
      group.setAttribute('aria-label',field.firstElementChild?.textContent||select.id);
      for(const button of buttons){
        const option=[...select.options].find(o=>o.value===button.dataset.value),selected=select.value===option.value;
        button.querySelector('.choice-label').textContent=option.textContent;
        button.setAttribute('aria-checked',String(selected));button.tabIndex=selected?0:-1;
        if(selected && button.parentElement===more?.lastChild)more.open=true;
      }
      if(more)more.firstChild.textContent=document.documentElement.lang.startsWith('zh')?'其他应用':'Other apps';
    };
    group.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
      event.preventDefault();let index=buttons.indexOf(document.activeElement);if(index<0)return;
      index=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+buttons.length)%buttons.length;
      buttons[index].click();buttons[index].focus();
    });
    select.after(group);select.addEventListener('change',sync);
    new MutationObserver(sync).observe(select,{subtree:true,childList:true,characterData:true});
    new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    sync();
    // Programmatic form refreshes call this without dispatching a user edit.
    select.syncChoices=sync;
  }
}
export function syncChoices(root=document){for(const select of root.querySelectorAll('select'))select.syncChoices?.();}
