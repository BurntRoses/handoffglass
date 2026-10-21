/** Place a card around grounded center-based DIP bounds, including negative displays. */
export function placePanel(area,target,{width=420,height=238,gap=16,margin=12}={}){
  const clamp=(v,min,max)=>Math.max(min,Math.min(v,Math.max(min,max)));
  const fit=point=>({x:Math.round(clamp(point.x,area.x+margin,area.x+area.width-width-margin)),
    y:Math.round(clamp(point.y,area.y+margin,area.y+area.height-height-margin))});
  if(!target || ![target.x,target.y].every(Number.isFinite))return fit({x:area.x+(area.width-width)/2,y:area.y+(area.height-height)/2});
  const w=Number.isFinite(target.width)?target.width:24,h=Number.isFinite(target.height)?target.height:24;
  const rect={left:target.x-w/2,right:target.x+w/2,top:target.y-h/2,bottom:target.y+h/2};
  const candidates=[{x:rect.right+gap,y:target.y-height/2},{x:rect.left-width-gap,y:target.y-height/2},
    {x:target.x-width/2,y:rect.bottom+gap},{x:target.x-width/2,y:rect.top-height-gap}].map(fit);
  const overlap=point=>Math.max(0,Math.min(point.x+width,rect.right+gap)-Math.max(point.x,rect.left-gap))*
    Math.max(0,Math.min(point.y+height,rect.bottom+gap)-Math.max(point.y,rect.top-gap));
  return candidates.sort((a,b)=>overlap(a)-overlap(b))[0];
}
