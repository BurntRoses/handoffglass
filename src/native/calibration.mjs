/** Passive layout integrity and re-observation checks. No screen capture or pointer control.
 * 'consistent' means metadata checks passed, NOT that a real UI target was verified.
 */
import { createHash } from 'node:crypto';
const rectFields = ['x','y','width','height'];
const validRect = r => r && rectFields.every(k => Number.isFinite(r[k])) && r.width > 0 && r.height > 0;
function overlaps(a,b) {
  return a.x < b.x+b.width && b.x < a.x+a.width && a.y < b.y+b.height && b.y < a.y+a.height;
}
export function layoutSignature(displays) {
  if(!Array.isArray(displays) || !displays.length || displays.length>16) return null;
  const entries=displays.map(d=>({id:String(d.id),dip:rectFields.map(k=>d[k]),
    physical:d.physicalBounds ? rectFields.map(k=>d.physicalBounds[k]) : null}));
  if(entries.some(e=>e.dip.some(v=>!Number.isFinite(v)) || e.physical?.some(v=>!Number.isFinite(v)))) return null;
  entries.sort((a,b)=>a.id.localeCompare(b.id));
  // Short-lived geometry revision, never stored to disk. No app names or window titles.
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex').slice(0,16);
}
export function inspectLayout(displays, platform = process.platform) {
  const issues=[];
  if (!Array.isArray(displays) || !displays.length || displays.length>16) return {status:'unknown',issues:['no_displays'],signature:null};
  const ids=new Set();
  for(const d of displays) {
    if(!d || typeof d.id!=='string' || ids.has(d.id) || !validRect(d) ||
       Math.abs(d.x)>100000 || Math.abs(d.y)>100000 || d.width>20000 || d.height>20000) issues.push('invalid_dip_geometry');
    if (d?.id) ids.add(d.id);
    if(!Number.isFinite(d?.scaleFactor) || d.scaleFactor<=0 || d.scaleFactor>8) issues.push('invalid_scale');
    if(platform==='win32' && !validRect(d?.physicalBounds)) issues.push('missing_physical_bounds');
  }
  if(issues.includes('invalid_dip_geometry')) return {status:'inconsistent',issues:[...new Set(issues)],signature:null};
  for(let i=0;i<displays.length;i++) for(let j=i+1;j<displays.length;j++){
    if(overlaps(displays[i],displays[j])) issues.push('overlapping_dip_displays');
    if(platform==='win32' && validRect(displays[i].physicalBounds) && validRect(displays[j].physicalBounds)
       && overlaps(displays[i].physicalBounds,displays[j].physicalBounds)) issues.push('overlapping_physical_displays');
  }
  return {status:issues.length?'inconsistent':'metadata_consistent',issues:[...new Set(issues)],signature:layoutSignature(displays)};
}
/** Agent-supplied previous observation is only a comparison hint, never trust evidence of success. */
export function compareObservation(previous,current,currentSignature,{toleranceDip=4}={}) {
  if(!previous || !current || ![previous.x,previous.y,previous.width,previous.height,current.x,current.y,current.width,current.height].every(Number.isFinite))
    return {state:'unavailable'};
  if(previous.layoutSignature && currentSignature && previous.layoutSignature !== currentSignature)
    return {state:'display_changed',locationVerified:false};
  const delta=Math.hypot(current.x-previous.x,current.y-previous.y);
  const sizeDelta=Math.max(Math.abs(current.width-previous.width),Math.abs(current.height-previous.height));
  if(delta>toleranceDip || sizeDelta>toleranceDip) return {state:'moved',deltaDip:Math.round(delta*10)/10,locationVerified:false};
  return {state:'unchanged',deltaDip:Math.round(delta*10)/10,locationVerified:false};
}
