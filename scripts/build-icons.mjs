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
// The open circle and separate point match assets/brandmark.svg.
function arcDistance(x,y){
 const dx=x-44,dy=y-44,a=Math.atan2(dy,dx)*180/Math.PI;
 if(a>-78&&a<-30)return Math.min(Math.hypot(x-59.588457,y-35),Math.hypot(x-47.74241,y-26.393343));
 return Math.abs(Math.hypot(dx,dy)-18);
}
function paint(x,y){
 const bg=roundRect(x,y,44,44,70,70,16);
 if(bg>1)return [0,0,0,0];
 const cover=clamp(.5-bg),color=[39,47,42];
 const ring=clamp(2.1-arcDistance(x,y));
 for(let i=0;i<3;i++)color[i]=color[i]*(1-ring)+[231,239,228][i]*ring;
 const dot=clamp(3.6-Math.hypot(x-61,y-26));
 for(let i=0;i<3;i++)color[i]=color[i]*(1-dot)+[156,204,177][i]*dot;
 return [...color,cover*255];
}
function trayPaint(x,y){
 x=44+(x-44)*.62;y=44+(y-44)*.62;
 const a=clamp(1.6-arcDistance(x,y)),b=clamp(3.6-Math.hypot(x-61,y-26));
 return [0,0,0,255*Math.max(a,b)];
}
function raster(size,painter=paint,extent=88){
 const out=Buffer.alloc(size*size*4),samples=size<=64?4:2;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const mix=[0,0,0,0];
  for(let j=0;j<samples;j++)for(let i=0;i<samples;i++){
   const rgba=painter((x+(i+.5)/samples)*extent/size,(y+(j+.5)/samples)*extent/size),a=rgba[3]/255;
   for(let k=0;k<3;k++)mix[k]+=rgba[k]*a;
   mix[3]+=a;
  }
  const offset=(y*size+x)*4;
  for(let k=0;k<3;k++)out[offset+k]=Math.round(mix[3]?mix[k]/mix[3]:0);
  out[offset+3]=Math.round(mix[3]*255/(samples*samples));
 }
 return png(size,out);
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
  writeFile(join(output,'icon.icns'),icns(results.filter(x=>x.n!==48))),
  writeFile(join(root,'src/desktop/assets/app.png'),results.find(x=>x.n===256).data),
  writeFile(join(root,'src/desktop/assets/tray.png'),raster(22,trayPaint)),
  writeFile(join(root,'src/desktop/assets/tray@2x.png'),raster(44,trayPaint))
]);
console.log(`Brand icons generated in ${output}`);
