/** One local operation for an explicit screen drawing, independent of task verification. */
export function quickMarkRequest(input, displays, preferences) {
  const {shape='ring',displayId,size=220,durationSeconds=20,color,requestId}=input;
  if(!['ring','double_ring','scribble','halo','dot','crosshair'].includes(shape))throw new TypeError('Invalid quick mark shape');
  if(!Number.isFinite(size)||size<24||size>800)throw new TypeError('size must be 24–800 DIP');
  if(!Number.isInteger(durationSeconds)||durationSeconds<10||durationSeconds>120)throw new TypeError('durationSeconds must be 10–120');
  if(color!==undefined&&!/^#[a-f0-9]{6}$/i.test(color))throw new TypeError('Invalid color');
  const display=displayId===undefined?(displays.find(d=>d.primary)||displays[0]):displays.find(d=>d.id===displayId);
  if(!display)throw Object.assign(new Error('Requested display unavailable'),{code:'no_display'});
  const diameter=Math.min(size,display.width-32,display.height-32);
  return {mode:'guide',continuous:false,title:'屏幕标记',message:'临时标记',requestId,
    timeoutSeconds:durationSeconds,visualStyle:preferences.visualStyle,motion:preferences.motion,
    locale:preferences.locale,theme:preferences.theme,density:preferences.density,
    annotations:[{id:'quick-mark',shape,x:display.x+display.width/2,y:display.y+display.height/2,
      width:diameter,height:diameter,color:color||'#52ca94',effect:'draw',durationMs:350,exit:'fade'}]};
}
