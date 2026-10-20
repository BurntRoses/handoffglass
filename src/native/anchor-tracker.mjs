/** Live, local-only anchored overlays. Never captures pixels or generates clicks.
 * Foreground Accessibility/UIA evidence is rechecked before reusing coordinates.
 */
import { canLocateAll } from '../geometry.mjs';
import { layoutSignature } from './calibration.mjs';

const allowedStatus = new Set(['tracking', 'lost', 'layout_changed', 'desktop_unavailable']);
const errorCodes = new Set(['consent_required','permission_denied','target_not_found','ambiguous_target',
  'display_mapping','native_timeout','native_error','no_desktop','helper_unavailable','unsupported_platform']);
const finiteRect = v => v && [v.x,v.y,v.width,v.height].every(Number.isFinite) && v.width > 0 && v.height > 0;
const shiftMarks = (annotations, origin, located) => annotations.map(a => {
  const followsSize = Math.abs(a.x-origin.x)<0.001 && Math.abs(a.y-origin.y)<0.001;
  return { ...a, x:a.x+located.x-origin.x, y:a.y+located.y-origin.y,
    ...(followsSize && a.width !== undefined ? {width:Math.max(1,a.width+located.width-origin.width)}:{}),
    ...(followsSize && a.height !== undefined ? {height:Math.max(1,a.height+located.height-origin.height)}:{}) };
});
const shiftScene = (scene, origin, located) => scene ? {
  ...scene, layers:scene.layers.map(layer => ({...layer, annotations:shiftMarks(layer.annotations,origin,located)}))
} : undefined;

export class NativeAnchorTracker {
  constructor({ manager, locator, getDisplays, desktopReady = () => true,
    intervalMs = 500, now = () => Date.now() }) {
    this.manager=manager; this.locator=locator; this.getDisplays=getDisplays;
    this.desktopReady=desktopReady; this.intervalMs=Math.max(500, intervalMs);
    this.now=now; this.current=null; this.timer=null; this.inflight=false; this.generation=0;
    this.onChange=s=>{if(this.current?.id===s.id) this.clear();};
    manager.on('change',this.onChange);
  }
  track(id,target,initial) {
    if (!finiteRect(initial) || this.manager.active()?.id!==id) return false;
    const s=this.manager.get(id);
    this.clear();
    this.current={id,target,origin:{...initial},baseline:s.annotations.map(a=>({...a})),
      scene:s.scene ? structuredClone(s.scene):undefined, signature:layoutSignature(this.getDisplays())};
    this.manager.setAnchorState(id,{status:'tracking',annotations:s.annotations,observedAt:this.now(),
      signature:this.current.signature});
    this.#schedule(); return true;
  }
  clearFor(id){if(this.current?.id===id)this.clear();}
  clear(){this.generation++;clearTimeout(this.timer);this.timer=null;this.current=null;}
  close(){this.clear();this.manager.off('change',this.onChange);}
  #schedule() {
    if (!this.current)return;
    clearTimeout(this.timer);
    this.timer=setTimeout(()=>{void this.recheck().finally(()=>this.#schedule());},this.intervalMs);
    this.timer.unref?.();
  }
  invalidate(reason='layout_changed'){
    const anchor=this.current;
    if(!anchor)return;
    this.generation++;
    this.manager.setAnchorState(anchor.id,{status:reason,annotations:[],observedAt:null,
      signature:layoutSignature(this.getDisplays())});
    if(!this.inflight) { clearTimeout(this.timer); this.timer=null; this.#schedule(); }
  }
  async recheck() {
    const anchor=this.current;
    if(!anchor || this.inflight)return null;
    const s=this.manager.active();
    if(s?.id!==anchor.id){this.clear();return null;}
    const generation=this.generation;
    const displays=this.getDisplays();
    const signature=layoutSignature(displays);
    if(!this.desktopReady()) {
      this.manager.setAnchorState(anchor.id,{status:'desktop_unavailable',annotations:[],observedAt:null,signature});
      return 'desktop_unavailable';
    }
    if(signature !== anchor.signature){
      anchor.signature=signature;
      this.manager.setAnchorState(anchor.id,{status:'layout_changed',annotations:[],observedAt:null,signature});
      // The next independent read will reestablish the target after the layout changes.
      return 'layout_changed';
    }
    this.inflight=true;
    try {
      const located=await this.locator(anchor.target,displays);
      if(generation!==this.generation || this.current!==anchor || this.manager.active()?.id!==anchor.id)return 'obsolete';
      if(!finiteRect(located) || !canLocateAll(displays,[located]))throw Object.assign(new Error('Unreliable location'),{code:'display_mapping'});
      if(located.width>5000 || located.height>5000)throw Object.assign(new Error('Invalid target size'),{code:'display_mapping'});
      const annotations=shiftMarks(anchor.baseline,anchor.origin,located);
      if(!canLocateAll(displays,annotations))throw Object.assign(new Error('Overlay would leave display'),{code:'display_mapping'});
      this.manager.setAnchorState(anchor.id,{status:'tracking',annotations,
        ...(anchor.scene?{scene:shiftScene(anchor.scene,anchor.origin,located)}:{}),observedAt:this.now(),signature});
      return 'tracking';
    } catch(e) {
      if(generation!==this.generation || this.current!==anchor || this.manager.active()?.id!==anchor.id)return 'obsolete';
      this.manager.setAnchorState(anchor.id,{status:'lost',annotations:[],observedAt:null,signature,
        reason:errorCodes.has(e?.code)?e.code:'target_not_found'});
      return 'lost';
    } finally {this.inflight=false;}
  }
}
