#!/usr/bin/env node
/** Deterministic, dependency-free app icon generation for PNG / Windows ICO / macOS ICNS. */
import { writeFile, mkdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'build', 'icons');
const clamp = v => Math.max(0, Math.min(1, v));
function crc32(input) {
  let c=0xffffffff;
  for (const byte of input) {c^=byte; for(let b=0;b<8;b++)c=(c>>>1)^(0xedb88320&-(c&1));}
  return (c^0xffffffff)>>>0;
}
function chunk(name, body){const label=Buffer.from(name);const size=Buffer.alloc(4);size.writeUInt32BE(body.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([label,body])));return Buffer.concat([size,label,body,crc]);}
function png(size,pixels){
  const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
  const bytes=Buffer.alloc(size*(size*4+1));
  for(let y=0;y<size;y++){const base=y*(size*4+1);pixels.copy(bytes,base+1,y*size*4,(y+1)*size*4);}
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(bytes,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
function roundRect(x,y,cx,cy,w,h,r){const dx=Math.abs(x-cx)-w/2+r;const dy=Math.abs(y-cy)-h/2+r;return Math.hypot(Math.max(dx,0),Math.max(dy,0))+Math.min(Math.max(dx,dy),0)-r;}
function segment(x,y,ax,ay,bx,by){const dx=bx-ax,dy=by-ay;const t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy));return Math.hypot(x-ax-dx*t,y-ay-dy*t);}
function composite(base,top,a){const k=clamp(a);for(let i=0;i<3;i++)base[i]=base[i]*(1-k)+top[i]*k;}
function paint(x,y){
  const grad=clamp((x+y)/176),tint=[189-53*grad,255-69*grad,232+8*grad];
  const center=Math.hypot((x-44)/85,(y-35)/86);const color=[12+12*(1-center),19+30*(1-center),29+33*(1-center)];
  const bg=roundRect(x,y,44,44,86,86,24);
  if(bg>=0)return [0,0,0,0];
  composite(color,[103,151,164],clamp(.7-Math.abs(bg+1)/1.6)*.24);
  const outer=roundRect(x,y,40,44,40,48,7),outerLine=clamp(.88-Math.abs(outer)/1.4);
  composite(color,tint,outerLine*.75);
  const back=roundRect(x,y,51.5,47.5,34,40,7);composite(color,tint,clamp(.85-Math.abs(back)/1.25)*.56);
  const cross=Math.max(clamp(1.55-segment(x,y,30,48,58,48)),clamp(1.55-segment(x,y,44,34,44,61)));
  composite(color,tint,cross);
  const ring=Math.hypot(x-44,y-48);composite(color,[16,46,52],clamp(9.4-ring));
  composite(color,tint,clamp(1.5-Math.abs(ring-8.5)));
  composite(color,[234,255,247],clamp(3-ring));
  return [...color.map(v=>Math.round(v)),255];
}
function raster(size){
  const out=Buffer.alloc(size*size*4);const samples=size<=64?3:1;const alpha=1/(samples*samples);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const mix=[0,0,0,0];
    for(let j=0;j<samples;j++)for(let i=0;i<samples;i++){
      const rgba=paint((x+(i+.5)/samples)*88/size,(y+(j+.5)/samples)*88/size);
      for(let k=0;k<4;k++)mix[k]+=rgba[k]*alpha;
    }
    for(let k=0;k<4;k++)out[(y*size+x)*4+k]=Math.round(mix[k]);
  }return png(size,out);
}
function ico(images){
  const header=Buffer.alloc(6);header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);let offset=6+16*images.length;
  const entries=images.map(({n,data})=>{const b=Buffer.alloc(16);b[0]=n===256?0:n;b[1]=n===256?0:n;b[2]=0;b[3]=0;b.writeUInt16LE(1,4);b.writeUInt16LE(32,6);b.writeUInt32LE(data.length,8);b.writeUInt32LE(offset,12);offset+=data.length;return b;});
  return Buffer.concat([header,...entries,...images.map(x=>x.data)]);
}
function icns(images){
  const types=new Map([[16,'icp4'],[32,'icp5'],[64,'icp6'],[128,'ic07'],[256,'ic08'],[512,'ic09'],[1024,'ic10']]);
  const parts=images.map(({n,data})=>{const b=Buffer.alloc(8);b.write(types.get(n),0);b.writeUInt32BE(data.length+8,4);return Buffer.concat([b,data]);});
  const h=Buffer.alloc(8);h.write('icns',0);h.writeUInt32BE(8+parts.reduce((a,b)=>a+b.length,0),4);
  return Buffer.concat([h,...parts]);
}
await mkdir(output,{recursive:true});
const sizes=[16,32,48,64,128,256,512,1024];const results=[];
for(const n of sizes){const data=raster(n);results.push({n,data}); if([32,256,512,1024].includes(n))await writeFile(join(output,`icon-${n}.png`),data);}
await Promise.all([
  writeFile(join(output,'icon.ico'),ico(results.filter(x=>x.n<=256))),
  writeFile(join(output,'icon.icns'),icns(results.filter(x=>x.n!==48)))
]);
console.log(`Brand icons generated in ${output}`);
