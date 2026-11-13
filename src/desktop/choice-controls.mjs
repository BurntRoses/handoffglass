import { renderOverlay } from './overlay-renderer.mjs';
/** Small local radio groups. Native values remain form-backed and never open a menu. */
export function upgradeChoices(root=document){
  for(const select of root.querySelectorAll('select')){
    if(select.dataset.upgraded)continue;select.dataset.upgraded='true';select.hidden=true;
    let field=select.parentElement;
    if(field.tagName==='LABEL'){
      const div=document.createElement('div');for(const {name,value} of field.attributes)if(name!=='for')div.setAttribute(name,value);
      field.replaceWith(div);div.append(...field.childNodes);field=div;
    }
    const group=document.createElement('div');group.className=select.id==='host'?'choice-group host-choices':select.id==='visualStyle'?'choice-group style-choices':'choice-group segments';
    group.setAttribute('role','radiogroup');
    const buttons=[];
    let more,others;
    if(select.id==='host'){
      more=document.createElement('details');more.className='other-hosts';
      const summary=document.createElement('summary');more.append(summary);
      others=document.createElement('div');others.className='other-host-grid';more.append(others);group.append(more);
    }
    for(const option of select.options){
      const button=document.createElement('button');button.type='button';button.className='ui-button choice';button.dataset.value=option.value;button.setAttribute('role','radio');
      if(select.id==='visualStyle'){
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 44');svg.setAttribute('aria-hidden','true');
        renderOverlay(svg,{sessionId:'choice-'+option.value,visualStyle:option.value,motion:'off',annotations:[{id:'sample',x:50,y:22,width:46,height:22,shape:'ring',color:'#5c9278'}]},{width:100,height:44});button.append(svg);
      }
      if(select.id==='host' && ['codex','workbuddy'].includes(option.value)){
        const icon=document.createElement('span');icon.className='host-icon';const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','22');svg.setAttribute('height','22');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',option.value==='codex'?'m6 7 5 5-5 5m7 0h5':'M7 8a4 4 0 0 1 8 0v1m-8 2v-3m10 8a4 4 0 0 1-8 0v-1m8-2v3M5 12h14');path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.6');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');svg.append(path);icon.append(svg);icon.setAttribute('aria-hidden','true');button.append(icon);
      }
      const label=document.createElement('span');label.className='choice-label';button.append(label);
      if(more && !['codex','workbuddy'].includes(option.value))others.append(button);else group.insertBefore(button,more||null);
      button.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();});
      buttons.push(button);
    }
    const sync=()=>{
      const caption=field.firstElementChild;if(caption&&caption!==select){caption.id ||= 'choice-label-'+select.id;group.setAttribute('aria-labelledby',caption.id);}else group.setAttribute('aria-label',select.id);
      for(const button of buttons){
        const option=[...select.options].find(o=>o.value===button.dataset.value),selected=select.value===option.value;
        button.querySelector('.choice-label').textContent=option.textContent;
        button.disabled=select.disabled||option.disabled;button.setAttribute('aria-checked',String(selected));button.tabIndex=selected&&!button.disabled?0:-1;
        if(selected && button.parentElement===others)more.open=true;
      }
      if(!buttons.some(button=>button.tabIndex===0)) {
        const first=buttons.find(button=>!button.disabled);if(first)first.tabIndex=0;
      }
      if(more)more.firstChild.textContent=document.documentElement.lang.startsWith('zh')?'其他应用':'Other apps';
    };
    group.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
      const available=buttons.filter(button=>!button.disabled);let index=available.indexOf(document.activeElement);if(index<0)return;event.preventDefault();
      index=event.key==='Home'?0:event.key==='End'?available.length-1:(index+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+available.length)%available.length;
      available[index].click();available[index].focus();
    });
    select.after(group);select.addEventListener('change',sync);
    new MutationObserver(sync).observe(select,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled']});
    new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    sync();
    // Programmatic form refreshes call this without dispatching a user edit.
    select.syncChoices=sync;
  }
}
export function syncChoices(root=document){for(const select of root.querySelectorAll('select'))select.syncChoices?.();}
