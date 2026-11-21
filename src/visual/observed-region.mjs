/** Host-observed rectangles → global DIP. No capture, native lookup or permission probe. */
import {normalizeAnnotation,composeTemplate} from './scene.mjs';
import {layoutSignature as signatureFor} from '../native/calibration.mjs';
import {chooseAccent} from './contrast.mjs';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=(code,message)=>{throw Object.assign(new TypeError(message),{code});};
export function regionRect(value,name='bounds'){
  if(!object(value))fail('invalid_bounds',`${name} must be {x,y,width,height}`);
  const {x,y,width,height}=value;
  if(![x,y,width,height].every(Number.isFinite)||Math.abs(x)>100000||Math.abs(y)>100000||width<=0||height<=0||width>100000||height>100000)
    fail('invalid_bounds',`Invalid ${name}`);
  return {x,y,width,height};
}
const inside=(r,d)=>r.x>=d.x&&r.y>=d.y&&r.x+r.width<=d.x+d.width&&r.y+r.height<=d.y+d.height;
/** Full rectangle coverage, including adjacent displays; gaps are never drawing targets. */
export function regionOnDisplays(r,displays){
  const edges=[r.x,r.x+r.width,...displays.flatMap(d=>[Math.max(r.x,d.x),Math.min(r.x+r.width,d.x+d.width)])]
    .filter(x=>x>=r.x&&x<=r.x+r.width).sort((a,b)=>a-b);
  for(let i=1;i<edges.length;i++){
    if(edges[i]===edges[i-1])continue;
    const x=(edges[i]+edges[i-1])/2;
    const spans=displays.filter(d=>x>=d.x&&x<d.x+d.width).map(d=>[d.y,d.y+d.height]).sort((a,b)=>a[0]-b[0]);
    let end=r.y;
    for(const [top,bottom]of spans){if(top>end)break;end=Math.max(end,bottom);}
    if(end<r.y+r.height)return false;
  }
  return true;
}
/** Without frame, bounds are global DIP. With frame, bounds are pixels in the exact supplied image. */
export function observedRegion(bounds,frame,displays,{validateOnly=false,now=Date.now(),layoutSignature=signatureFor(displays),observation}={}){
  let r=regionRect(bounds);
  if(frame!==undefined){
    if(!object(frame)||![frame.width,frame.height].every(n=>Number.isFinite(n)&&n>0&&n<=100000))fail('invalid_frame','frame needs image width, height and its global DIP bounds');
    const viewport=regionRect(frame.bounds,'frame.bounds');
    if(r.x<0||r.y<0||r.x+r.width>frame.width||r.y+r.height>frame.height)fail('outside_frame','bounds exceed the supplied image');
    if(frame.capturedAt!==undefined&&(!Number.isFinite(frame.capturedAt)||now-frame.capturedAt>30000||frame.capturedAt-now>2000))fail('stale_observation','Capture is stale; observe the original app again');
    if(frame.layoutSignature!==undefined&&(typeof frame.layoutSignature!=='string'||!/^[a-f0-9]{16}$/.test(frame.layoutSignature)))fail('invalid_frame','Invalid frame.layoutSignature');
    if(!validateOnly){
      if(frame.layoutSignature!==undefined&&frame.layoutSignature!==layoutSignature)fail('layout_changed','Display layout changed; observe again');
      if(!displays.some(d=>inside(viewport,d)))fail('ambiguous_frame','An image frame must map to one display; use one frame per display, or measured global DIP bounds');
    }
    r={x:viewport.x+r.x*viewport.width/frame.width,y:viewport.y+r.y*viewport.height/frame.height,
      width:r.width*viewport.width/frame.width,height:r.height*viewport.height/frame.height};
  }
  const evidence=frame??observation;
  if(!evidence||!Number.isFinite(evidence.capturedAt)||typeof evidence.layoutSignature!=='string'||!['host','native','user'].includes(evidence.provenance))fail('observation_required','Supply observed capturedAt, layoutSignature and provenance; otherwise use coordinate-free guidance');
  if(now-evidence.capturedAt>30000||evidence.capturedAt-now>2000)fail('stale_observation','Observation is older than 30 seconds; observe the original app again');
  if(!/^[a-f0-9]{16}$/.test(evidence.layoutSignature))fail('invalid_frame','Invalid layoutSignature');
  if(!validateOnly&&evidence.layoutSignature!==layoutSignature)fail('layout_changed','Display layout changed; observe again');
  if(r.width>5000||r.height>5000||Math.abs(r.x+r.width/2)>100000||Math.abs(r.y+r.height/2)>100000)fail('invalid_bounds','Mapped region exceeds the renderer limits');
  if(!validateOnly&&!regionOnDisplays(r,displays))fail('outside_display','Observed region is outside the connected displays');
  const backgroundColors=evidence.backgroundColors;
  if(backgroundColors!==undefined && (!Array.isArray(backgroundColors)||backgroundColors.length<1||
    backgroundColors.length>8||backgroundColors.some(color=>typeof color!=='string'||!/^#[a-f0-9]{6}$/i.test(color))))
    fail('invalid_background_colors','Provide 1–8 sampled six-digit colors from around the target');
  return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height,
    ...(backgroundColors?{backgroundColors}:{})};
}
export function observedScene(input,displays,context={}){
  if(input.scrollTarget)return scrollScene(input,displays,context);
  const {backgroundColors,...hit}=observedRegion(input.bounds,input.frame,displays,{...context,observation:input.observation});
  const template=input.template??(!input.shape&&['caution','verify'].includes(input.intent)?input.intent:undefined);
  const mark=normalizeAnnotation({...input,...hit,id:'mark_1',shape:input.shape??'auto'});
  const scene=template?composeTemplate(template,[mark]):
    {version:1,layers:[{id:'observed',annotations:[mark]}]};
  const autoColor=input.color===undefined||input.color==='auto';
  for(const layer of scene.layers)for(const annotation of layer.annotations){
    annotation.color=autoColor?chooseAccent(annotation.color,backgroundColors):mark.color;
    if(autoColor)annotation.autoColor=true;
    else delete annotation.autoColor;
  }
  return scene;
}
const SCROLL_TEXT={
  'zh-CN':{up:'向上滚动',down:'向下滚动',left:'向左滚动',right:'向右滚动'},
  'en-US':{up:'Scroll up',down:'Scroll down',left:'Scroll left',right:'Scroll right'}
};
function scrollScene(input,displays,context){
  const {viewport,target,label}=input.scrollTarget;
  const view=regionRect(viewport,'scroll viewport'),outside=regionRect(target,'scroll target');
  const horizontal=outside.x+outside.width<=view.x?'left':outside.x>=view.x+view.width?'right':null;
  const vertical=outside.y+outside.height<=view.y?'up':outside.y>=view.y+view.height?'down':null;
  if(!horizontal&&!vertical||horizontal&&vertical)fail('invalid_scroll_target','Supply a target wholly beyond one edge of the observed scroll viewport');
  const direction=horizontal||vertical;
  const box=observedRegion(view,input.frame,displays,{...context,observation:input.observation});
  if(box.width<72||box.height<72)fail('invalid_scroll_target','The visible scroll viewport is too small for a directional mark');
  const dx=(outside.x+outside.width/2-view.x)/view.width-.5;
  const dy=(outside.y+outside.height/2-view.y)/view.height-.5;
  const fit=(center,offset,length)=>center+Math.max(32-length/2,Math.min(length/2-32,offset*length));
  const x=horizontal?box.x+(direction==='left'?-1:1)*(box.width/2-22):fit(box.x,dx,box.width);
  const y=vertical?box.y+(direction==='up'?-1:1)*(box.height/2-22):fit(box.y,dy,box.height);
  const instruction=(SCROLL_TEXT[input.locale]??SCROLL_TEXT['zh-CN'])[direction];
  const name=typeof label==='string'?label.trim().slice(0,45):'';
  const mark=normalizeAnnotation({id:'mark_1',x,y,width:26,height:26,shape:'arrow',direction,scrollDirection:direction,
    label:name?`${instruction} · ${name}`:instruction,color:input.color,effect:'still'});
  if(input.color==null||input.color==='auto'){
    mark.color=chooseAccent(mark.color,box.backgroundColors);mark.autoColor=true;
  }
  return {version:1,layers:[{id:'observed',annotations:[mark]}]};
}
export function observedTarget(bounds,frame,displays,context={}){
  const hit=observedRegion(bounds,frame,displays,context),evidence=frame??context.observation,now=context.now??Date.now();
  return {bounds:{x:hit.x-hit.width/2,y:hit.y-hit.height/2,width:hit.width,height:hit.height},frame:frame?structuredClone(frame):null,capturedAt:evidence.capturedAt,layoutSignature:evidence.layoutSignature,provenance:evidence.provenance,
    ...(hit.backgroundColors?{backgroundColors:[...hit.backgroundColors]}:{}),
    freshness:{status:'fresh',ageMs:Math.max(0,now-evidence.capturedAt),maxAgeMs:30000}};
}
