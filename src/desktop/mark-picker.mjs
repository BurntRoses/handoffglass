import { MARK_CATEGORIES, MARK_NAMES } from '../visual/catalog.mjs';
import { renderOverlay } from './overlay-renderer.mjs';
/** Five functional groups; thumbnails always use the production renderer. */
export function createMarkPicker({categories,choices,onChange,shape='spotlight',locale=()=> 'zh-CN'}) {
  let current=shape,category=MARK_CATEGORIES.find(c=>c.shapes.includes(shape)).id;
  const buttons=(root,role)=>{
    root.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
      const items=[...root.querySelectorAll(`button[role=${role}]`)];let i=items.indexOf(document.activeElement);if(i<0)return;
      event.preventDefault();i=event.key==='Home'?0:event.key==='End'?items.length-1:(i+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+items.length)%items.length;
      items[i].click();root.querySelectorAll(`button[role=${role}]`)[i]?.focus();
    });
  };
  buttons(categories,'tab');buttons(choices,'radio');
  function refresh(){
    const zh=locale()==='zh-CN';categories.replaceChildren();choices.replaceChildren();
    for(const c of MARK_CATEGORIES){
      const button=document.createElement('button');button.type='button';button.setAttribute('role','tab');button.dataset.category=c.id;
      button.setAttribute('aria-selected',String(c.id===category));button.tabIndex=c.id===category?0:-1;button.textContent=zh?c.zh:c.en;
      button.addEventListener('click',()=>{category=c.id;current=c.shapes.includes(current)?current:c.shapes[0];refresh();categories.querySelector('[aria-selected=true]')?.focus({preventScroll:true});onChange(current);});categories.append(button);
    }
    const selected=MARK_CATEGORIES.find(c=>c.id===category);choices.setAttribute('aria-label',zh?selected.zh:selected.en);
    for(const key of selected.shapes){
      const button=document.createElement('button');button.type='button';button.className='mark-choice';button.dataset.shape=key;
      button.setAttribute('role','radio');button.setAttribute('aria-checked',String(key===current));button.tabIndex=key===current?0:-1;
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-hidden','true');
      const text=document.createElement('span');text.textContent=MARK_NAMES[key][zh?0:1];button.append(svg,text);
      renderOverlay(svg,{motion:'off',annotations:[{id:'sample',shape:key,x:55,y:36,width:40,height:20,color:'#67b395',label:key==='badge'?'2':''}]},{width:110,height:72});
      button.addEventListener('click',()=>{current=key;for(const b of choices.children){b.setAttribute('aria-checked',String(b===button));b.tabIndex=b===button?0:-1;}onChange(key);});choices.append(button);
    }
  }
  refresh();return {refresh,get shape(){return current;}};
}
