/** Safe, deterministic relative display geometry for an SVG diagram. No pixel capture. */
export function layoutDisplays(displays, {width=700,height=260,padding=22}={}) {
  if(!Array.isArray(displays)||displays.length>16||
    ![width,height,padding].every(Number.isFinite)||width<160||height<80||padding<0)throw new TypeError('Invalid display layout');
  const accepted=[];
  for(const d of displays){
    const b=d?.bounds;
    if(!b||![b.x,b.y,b.width,b.height,d.scaleFactor].every(Number.isFinite)||
      b.width<=0||b.height<=0||b.width>20000||b.height>20000||d.scaleFactor<=0||d.scaleFactor>8)continue;
    accepted.push({id:String(d.id).slice(0,32),x:b.x,y:b.y,width:b.width,height:b.height,scale:d.scaleFactor,primary:!!d.primary});
  }
  if(!accepted.length)return {width,height,items:[],origin:null};
  const minX=Math.min(...accepted.map(x=>x.x)),minY=Math.min(...accepted.map(x=>x.y));
  const maxX=Math.max(...accepted.map(x=>x.x+x.width)),maxY=Math.max(...accepted.map(x=>x.y+x.height));
  const sizeX=maxX-minX,sizeY=maxY-minY;
  const factor=Math.min((width-2*padding)/sizeX,(height-2*padding)/sizeY);
  if(!Number.isFinite(factor)||factor<=0)return {width,height,items:[],origin:null};
  const offsetX=(width-sizeX*factor)/2,offsetY=(height-sizeY*factor)/2;
  return {width,height,origin:{x:minX,y:minY},items:accepted.map((d,i)=>({
    id:d.id,label:`${i+1}${d.primary?' · primary':''}`,scale:d.scale,
    dip:{x:d.x,y:d.y,width:d.width,height:d.height},
    x:Math.round((d.x-minX)*factor+offsetX),y:Math.round((d.y-minY)*factor+offsetY),
    width:Math.round(d.width*factor),height:Math.round(d.height*factor),primary:d.primary
  }))};
}
