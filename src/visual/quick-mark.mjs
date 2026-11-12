import {SHAPES, EFFECTS, EXIT_STYLES, MASK_STYLES, normalizeAnnotation} from './scene.mjs';
import {observedRegion} from './observed-region.mjs';

export const PLACEMENTS=Object.freeze(['center','top','bottom','left','right','top_left','top_right','bottom_left','bottom_right']);
export const DIRECTIONS=Object.freeze(['auto','left','right','up','down']);
const finite=(v,min,max,key)=>{if(!Number.isFinite(v)||v<min||v>max)throw new TypeError(`Invalid ${key}`);return v;};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
/** Compile a small semantic drawing locally. No observation, model, filesystem or timer. */
export function quickMarkRequest(input, displays, preferences={}, context={}) {
  const {validateOnly=false}=context;
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Invalid drawing');
  const {displayId,durationSeconds=20,requestId,sequence=false}=input;
  if(input.visualStyle!==undefined&&!['minimal','luminous','handdrawn'].includes(input.visualStyle))throw new TypeError('Invalid visualStyle');
  if(input.motion!==undefined&&!['off','gentle','expressive'].includes(input.motion))throw new TypeError('Invalid motion');
  if(!Number.isInteger(durationSeconds)||durationSeconds<10||durationSeconds>120)throw new TypeError('durationSeconds must be 10–120');
  if(typeof sequence!=='boolean')throw new TypeError('Invalid sequence');
  const display=displayId===undefined?(displays.find(d=>d.primary)||displays[0]):displays.find(d=>d.id===displayId);
  if(!display)throw Object.assign(new Error('Requested display unavailable'),{code:'no_display'});
  const specs=input.marks??[input];
  if(input.bounds!==undefined&&input.marks!==undefined)throw new TypeError('Use per-mark bounds to position a drawing group');
  if(!Array.isArray(specs)||!specs.length||specs.length>8)throw new TypeError('marks must contain 1–8 items');
  const annotations=[],ids=new Set();
  const markIds=new Set(specs.map((s,i)=>input.marks?(s?.id??`mark_${i+1}`):'mark_1'));
  for(const [i,spec] of specs.entries()){
    if(!spec||typeof spec!=='object'||Array.isArray(spec))throw new TypeError('Invalid mark');
    const options={...input,...spec}, {shape='ring',placement='center',direction='auto',label='',color='#52ca94',effect='draw',exit='fade',maskStyle='soft',strokeWidth=2.4,lineStyle='solid'}=options;
    if(options.frame!==undefined&&options.bounds===undefined)throw new TypeError('frame requires bounds');
    if(options.bounds!==undefined&&['position','placement','width','height','size'].some(k=>options[k]!==undefined))throw new TypeError('Choose bounds or position/placement/size');
    if(!SHAPES.includes(shape)||!PLACEMENTS.includes(placement)||!DIRECTIONS.includes(direction)||!EFFECTS.includes(effect)||!EXIT_STYLES.includes(exit)||!MASK_STYLES.includes(maskStyle))throw new TypeError('Invalid drawing style or placement');
    if(typeof label!=='string'||[...label].length>64)throw new TypeError('label must be at most 64 characters');
    const size=finite(options.size??220,24,800,'size');
    let width=Math.min(finite(options.width??size,24,1200,'width'),display.width-64);
    let height=Math.min(finite(options.height??size,24,1200,'height'),display.height-64);
    const [horizontal,vertical]=[placement.includes('left')?-1:placement.includes('right')?1:0,placement.includes('top')?-1:placement.includes('bottom')?1:0];
    let x=display.x+display.width*(.5+horizontal*.28),y=display.y+display.height*(.5+vertical*.28);
    if(options.bounds!==undefined){
      const hit=observedRegion(options.bounds,options.frame,displayId===undefined?displays:[display],{...context,observation:options.observation});
      ({x,y,width,height}=hit);
    }else if(options.position!==undefined){
      if(!options.position||typeof options.position!=='object')throw new TypeError('Invalid position');
      x=finite(options.position.x,-100000,100000,'position.x');y=finite(options.position.y,-100000,100000,'position.y');
      if(!validateOnly&&(x<display.x||x>=display.x+display.width||y<display.y||y>=display.y+display.height))throw new TypeError('position is outside the chosen display');
    }else{
      x=clamp(x,display.x+width/2+24,display.x+display.width-width/2-24);
      y=clamp(y,display.y+height/2+24,display.y+display.height-height/2-24);
    }
    const id=input.marks?(spec.id??`mark_${i+1}`):'mark_1';
    if(ids.has(id))throw new TypeError('Duplicate mark id');ids.add(id);
    const mark=normalizeAnnotation({id,shape,x,y,width,height,label,color,effect,exit,maskStyle,direction,strokeWidth,lineStyle,durationMs:350,delayMs:sequence?i*90:0});
    annotations.push(mark);
    if(sequence){
      let badgeId=`step_${i+1}`;while(markIds.has(badgeId))badgeId='n_'+badgeId;
      annotations.push(normalizeAnnotation({...mark,id:badgeId,shape:'badge',label:String(i+1),lineStyle:'solid'}));
    }
  }
  return {mode:'guide',continuous:false,title:'屏幕标记',message:'临时标记',requestId,
    timeoutSeconds:durationSeconds,visualStyle:input.visualStyle??preferences.visualStyle,motion:input.motion??preferences.motion,
    locale:preferences.locale,theme:preferences.theme,density:preferences.density,annotations};
}
export function drawingScene(request){return {version:1,layers:[{id:'drawing',annotations:request.annotations}]};}
