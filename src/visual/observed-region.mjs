/** Host-observed rectangles → global DIP. No capture, native lookup or permission probe. */
import {normalizeAnnotation,composeTemplate} from './scene.mjs';
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
export function observedRegion(bounds,frame,displays,{validateOnly=false,now=Date.now(),layoutSignature}={}){
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
  if(r.width>5000||r.height>5000||Math.abs(r.x+r.width/2)>100000||Math.abs(r.y+r.height/2)>100000)fail('invalid_bounds','Mapped region exceeds the renderer limits');
  if(!validateOnly&&!regionOnDisplays(r,displays))fail('outside_display','Observed region is outside the connected displays');
  return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height};
}
export function observedScene(input,displays,context={}){
  const hit=observedRegion(input.bounds,input.frame,displays,context);
  const mark=normalizeAnnotation({...input,...hit,id:'mark_1',shape:input.shape??'spotlight'});
  return input.template||(!input.shape&&input.intent)?composeTemplate(input.template??input.intent,[mark]):
    {version:1,layers:[{id:'observed',annotations:[mark]}]};
}
