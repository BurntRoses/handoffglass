/** Browser-level checks for the shared frontend contract, reused by UI smoke tests. */
import assert from 'node:assert/strict';
export async function assertPalette(webContents) {
  const pairs=await webContents.executeJavaScript(`(()=>{
    const probe=document.createElement('span');probe.hidden=true;document.body.append(probe);
    const roles=[];
    for(const background of ['surface','raised','ambient','selection'])for(const foreground of ['ink','sub','dim','accent']){
      probe.style.color='var(--'+foreground+')';probe.style.backgroundColor='var(--'+background+')';
      const style=getComputedStyle(probe);roles.push({foreground,background,color:style.color,surface:style.backgroundColor});
    }
    probe.style.color='var(--button-ink)';probe.style.backgroundColor='var(--button)';
    const style=getComputedStyle(probe);roles.push({foreground:'button-ink',background:'button',color:style.color,surface:style.backgroundColor});
    probe.remove();return roles;
  })()`);
  const luminance=color=>{
    const channels=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
  };
  const ratios=pairs.map(pair=>{const [a,b]=[luminance(pair.color),luminance(pair.surface)].sort((a,b)=>b-a);return {...pair,ratio:(a+.05)/(b+.05)};});
  for(const pair of ratios)assert.ok(pair.ratio>=4.5,`${pair.foreground}/${pair.background} contrast ${pair.ratio.toFixed(2)} < 4.5`);
  return Math.min(...ratios.map(pair=>pair.ratio));
}
export async function assertNoHorizontalOverflow(webContents,label) {
  const sizes=await webContents.executeJavaScript('({width:innerWidth,scroll:document.documentElement.scrollWidth})');
  assert.ok(sizes.scroll<=sizes.width+1,`${label}: ${sizes.scroll}px content exceeds ${sizes.width}px viewport`);
}
