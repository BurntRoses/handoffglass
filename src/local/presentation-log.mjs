/** Three independent projections consume one ordered, memory-only event log.
 * No action executor, file contents, screenshot storage or disk history exists here.
 */
import {EventEmitter} from 'node:events';
import {randomUUID,createHash} from 'node:crypto';
import {redact} from './redact.mjs';
import {normalizeChange,RISKS} from './change.mjs';
const reviewKey=(owner,changes)=>createHash('sha256').update(JSON.stringify([owner,changes])).digest('hex');
export class PresentationLog extends EventEmitter{
  constructor({now=Date.now,limit=96}={}){
    super();this.now=now;this.limit=limit;this.seq=0;this.events=[];this.owners=new Map();this.timers=new Map();this.refusals=new Map();
    this.enabled={guidance:true,review:true,verification:true};this.views={guidance:null,review:null,verification:null};this.appearance={locale:'zh-CN',theme:'system'};
    this.on('entry',e=>{
      if(e.type==='guidance_changed')this.views.guidance=e.payload.session;
      if(e.type==='verification_recorded')this.views.verification=e.payload.session;
      if(e.type==='review_presented'||e.type==='review_decided')this.views.review=e.payload.review;
    });
  }
  append(sessionId,type,actor,risk,payload){
    const entry={sessionId,seq:++this.seq,type,actor,risk,timestamp:this.now(),payload:structuredClone(payload)};
    this.events.push(entry);if(this.events.length>this.limit)this.events.shift();
    this.emit('entry',structuredClone(entry));this.emit('change');return entry;
  }
  configure(prefs){
    this.appearance={locale:prefs.locale??this.appearance.locale,theme:prefs.theme??this.appearance.theme};
    if(prefs.enabled===false&&this.views.review?.status==='waiting_review')this.decide(this.views.review.id,this.views.review.revision,'declined','user');
    for(const key of Object.keys(this.enabled))this.enabled[key]=prefs.enabled!==false&&prefs[key+'Enabled']!==false;
    this.emit('change');
  }
  observe(session){
    this.append(session?.id??null,'guidance_changed','broker',session?.sensitive?'high':'low',{session});
    if(session?.phase==='verifying'||session?.verification)this.append(session.id,'verification_recorded','host',session.sensitive?'high':'low',{session:{...session,annotations:[],scene:undefined}});
    else this.append(session?.id??null,'verification_recorded','broker','low',{session:null});
  }
  snapshot(){return Object.fromEntries(Object.entries(this.views).map(([k,v])=>[k,this.enabled[k]&&v?structuredClone(k==='review'?{...v,...this.appearance}:v):null]));}
  present({changes,timeoutSeconds=300},owner){
    if(!this.enabled.review)return {error:'review_disabled'};
    if(!Array.isArray(changes)||changes.length<1||changes.length>24||!Number.isInteger(timeoutSeconds)||timeoutSeconds<10||timeoutSeconds>600)throw new TypeError('Expected 1–24 changes and 10–600 second timeout');
    const prior=this.views.review;
    const safe=changes.map(normalizeChange),risk=RISKS[Math.max(...safe.map(c=>RISKS.indexOf(c.risk)))],id=randomUUID();
    const refused=this.refusals.get(reviewKey(owner,safe));if(refused)return {review:structuredClone(refused)};
    if(prior&&this.owners.get(prior.id)===owner&&JSON.stringify(prior.changes)===JSON.stringify(safe))return {review:structuredClone(prior)};
    if(prior?.status==='waiting_review')return {error:'busy'};
    const review={id,revision:1,changes:safe,risk,readOnly:true,status:'waiting_review',nextAction:'await_human_review',deadline:this.now()+timeoutSeconds*1000};
    this.owners.set(id,owner);while(this.owners.size>64)this.owners.delete(this.owners.keys().next().value);
    this.append(id,'review_presented','agent',risk,{review});
    const timer=setTimeout(()=>this.decide(id,1,'declined','timeout'),timeoutSeconds*1000);timer.unref?.();this.timers.set(id,timer);
    return {review:structuredClone(review)};
  }
  owned(id,owner){return this.owners.get(id)===owner&&this.views.review?.id===id?structuredClone(this.views.review):null;}
  decide(id,revision,decision,actor='user'){
    const current=this.views.review;
    if(!current||current.id!==id||current.revision!==revision||current.status!=='waiting_review')return {error:'stale_review'};
    if(!['reviewed','declined'].includes(decision))throw new TypeError('Invalid review decision');
    if(this.now()>=current.deadline){decision='declined';actor='timeout';}
    clearTimeout(this.timers.get(id));this.timers.delete(id);
    const review={...current,revision:revision+1,status:decision,nextAction:decision==='declined'?'respect_refusal':'host_check_before_continuing'};
    if(decision==='declined'){this.refusals.set(reviewKey(this.owners.get(id),review.changes),review);while(this.refusals.size>96)this.refusals.delete(this.refusals.keys().next().value);}
    this.append(id,'review_decided',actor,current.risk,{review});return {review:structuredClone(review)};
  }
  async wait(id,owner,timeoutMs=20000){
    const current=this.owned(id,owner);if(!current)return {error:'not_found'};
    if(current.status!=='waiting_review'||!timeoutMs)return {review:current};
    if(this.listenerCount('change')>=64)return {error:'too_many_waits'};
    return new Promise(resolve=>{
      const finish=()=>{clearTimeout(timer);this.off('change',changed);this.off('closing',finish);resolve({review:this.owned(id,owner)});};
      const changed=()=>{if(this.owned(id,owner)?.status!=='waiting_review')finish();};
      const timer=setTimeout(finish,Math.min(30000,timeoutMs));this.on('change',changed);this.once('closing',finish);changed();
    });
  }
  export(id,{confirmed=false}={}){
    if(!confirmed)throw new Error('explicit_confirmation_required');
    // Export only the summary model, never guidance text or the manager snapshot.
    const entries=this.events.filter(e=>e.sessionId===id&&e.type.startsWith('review_')).map(e=>({...e,payload:{review:{...e.payload.review,changes:e.payload.review.changes.map(c=>({...c,summary:redact(c.summary).text,before:{...c.before,summary:redact(c.before.summary).text},after:{...c.after,summary:redact(c.after.summary).text}}))}}}));
    return structuredClone({schemaVersion:1,readOnly:true,entries});
  }
  close(){for(const timer of this.timers.values())clearTimeout(timer);this.emit('closing');this.removeAllListeners();this.events=[];this.owners.clear();this.refusals.clear();}
}
