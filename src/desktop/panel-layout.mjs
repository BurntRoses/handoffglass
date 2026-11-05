/** Place one card around grounded center-based DIP bounds, without covering another target. */
export function placePanel(area,target,{width=420,height=238,gap=16,margin=12,targets=target?[target]:[],previous=null,compact=false}={}){
  width=Math.min(width,Math.max(1,area.width-margin*2));height=Math.min(height,Math.max(1,area.height-margin*2));
  const clamp=(v,min,max)=>Math.max(min,Math.min(v,Math.max(min,max)));
  const fit=point=>({x:Math.round(clamp(point.x,area.x+margin,area.x+area.width-width-margin)),y:Math.round(clamp(point.y,area.y+margin,area.y+area.height-height-margin))});
  if(compact)return fit({x:area.x+(area.width-width)/2,y:area.y+margin});
  if(!target||![target.x,target.y].every(Number.isFinite))return fit({x:area.x+(area.width-width)/2,y:area.y+(area.height-height)/2});
  const rect=t=>({left:t.x-(t.width||24)/2,right:t.x+(t.width||24)/2,top:t.y-(t.height||24)/2,bottom:t.y+(t.height||24)/2});
  const r=rect(target),rects=targets.filter(t=>[t.x,t.y].every(Number.isFinite)).map(rect);
  const overlap=p=>rects.reduce((sum,b)=>sum+Math.max(0,Math.min(p.x+width,b.right+gap)-Math.max(p.x,b.left-gap))*Math.max(0,Math.min(p.y+height,b.bottom+gap)-Math.max(p.y,b.top-gap)),0);
  const candidates=[{x:r.right+gap,y:target.y-height/2},{x:r.left-width-gap,y:target.y-height/2},{x:target.x-width/2,y:r.bottom+gap},{x:target.x-width/2,y:r.top-height-gap}].map(fit);
  const best=candidates.sort((a,b)=>overlap(a)-overlap(b))[0];
  if(previous){const p=fit(previous);if(p.x===previous.x&&p.y===previous.y&&overlap(p)===0&&Math.hypot(p.x-best.x,p.y-best.y)<48)return p;}
  return best;
}
