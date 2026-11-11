/** Native DOM adaptation of shadcn Accordion's trigger/content state contract. */
export function disclosure(content, trigger, {expanded=true,onSize=()=>{}}={}) {
  let open=expanded,animation=null,frame=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const finish=()=>{content.hidden=!open;content.inert=!open;content.style.height='';content.style.overflow='';onSize();};
  const resize=()=>{onSize();if(animation)frame=requestAnimationFrame(resize);};
  const set=(next,{instant=false}={})=>{
    next=Boolean(next);if(next===open && !instant)return;
    const from=content.hidden?0:content.getBoundingClientRect().height;
    animation?.cancel();animation=null;cancelAnimationFrame(frame);
    open=next;trigger.setAttribute('aria-expanded',String(open));
    trigger.dataset.state=content.dataset.state=open?'open':'closed';
    if(!open && content.contains(document.activeElement))trigger.focus();
    content.hidden=false;content.inert=!open;content.style.height='';
    const to=open?content.scrollHeight:0;
    if(instant||reduced.matches||Math.abs(from-to)<1){finish();return;}
    content.style.overflow='hidden';
    const current=content.animate([{height:from+'px',opacity:from?1:0},{height:to+'px',opacity:open?1:0}],
      {duration:Math.max(90,Math.min(200,200*Math.abs(to-from)/Math.max(to,from,1))),easing:'cubic-bezier(.16,1,.3,1)',fill:'both'});
    animation=current;frame=requestAnimationFrame(resize);
    current.finished.then(()=>{if(animation!==current)return;animation=null;current.cancel();finish();}).catch(()=>{});
  };
  trigger.setAttribute('aria-controls',content.id);
  set(open,{instant:true});
  return {set,get expanded(){return open;},dispose(){animation?.cancel();animation=null;cancelAnimationFrame(frame);}};
}

export function enhanceDetails(root=document) {
  for(const details of root.querySelectorAll('details:not([data-disclosure])')) {
    const trigger=details.querySelector(':scope > summary');if(!trigger)continue;
    details.dataset.disclosure='true';
    const content=document.createElement('div');content.className='disclosure-content';
    content.id=details.id?details.id+'-content':'disclosure-'+crypto.randomUUID();
    for(const node of [...details.childNodes])if(node!==trigger)content.append(node);
    details.append(content);
    const initially=details.open;
    let controller;
    controller=disclosure(content,trigger,{expanded:initially,onSize:()=>{
      if(controller && !controller.expanded && content.hidden)details.open=false;
    }});
    trigger.addEventListener('click',event=>{
      event.preventDefault();const next=!controller.expanded;
      if(next)details.open=true;
      controller.set(next);
    });
    details.addEventListener('toggle',()=>{
      if(details.open && content.hidden)controller.set(true);
      else if(!details.open && controller.expanded)controller.set(false,{instant:true});
    });
  }
}

if(typeof document!=='undefined')enhanceDetails();
