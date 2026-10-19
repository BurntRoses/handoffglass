/** Bounded, memory-only handoff transitions. No target names, coordinates, task
 * text, account data or tokens ever enter the event log.
 * This is a chronology of OBSERVATIONS, not a proof of external task success.
 */
const TERMINAL = new Set(['completed','declined','cancelled','expired','superseded']);
const REASONS = new Set(['consent_required','permission_denied','target_not_found',
  'ambiguous_target','display_mapping','native_timeout','native_error',
  'no_desktop','helper_unavailable','unsupported_platform']);
export const EVENT_TYPES = Object.freeze(['started','target_acquired','target_moved',
  'target_lost','target_restored','display_changed','desktop_unavailable',
  'scene_changed','tracking_released','completed','declined','cancelled',
  'expired','superseded']);
const TYPES = new Set(EVENT_TYPES);
const rectangle = s => JSON.stringify((s?.annotations ?? []).map(
  a => [a.x,a.y,a.width,a.height,a.opacity]));

export function recoveryFor(session) {
  if (!session) return 'not_found';
  if (TERMINAL.has(session.status)) return ({completed:'verify_downstream',
    declined:'respect_refusal',cancelled:'stopped',expired:'request_again_if_needed',
    superseded:'follow_new_session'})[session.status];
  switch (session.targetTracking?.status) {
    case 'lost': return session.targetTracking.reason === 'consent_required' ||
      session.targetTracking.reason === 'permission_denied' ? 'check_accessibility_permission' : 'await_reacquisition';
    case 'layout_changed': return 'await_display_recalibration';
    case 'desktop_unavailable': return 'check_desktop_connection';
    case 'manual': return 'agent_owns_scene';
    default: return 'await_human_or_continue';
  }
}

export class InteractionJournal {
  constructor(manager, {now=()=>Date.now(),maxSessions=64,maxEvents=32}={}) {
    this.manager=manager;this.now=now;
    this.maxSessions=Math.max(2,Math.min(200,maxSessions));
    this.maxEvents=Math.max(4,Math.min(96,maxEvents));
    this.entries=new Map();
    this.onShow=session=>this.#observe(session,false);
    this.onChange=session=>this.#observe(session,true);
    manager.on('show',this.onShow);manager.on('change',this.onChange);
  }
  #append(record,type,reason) {
    if(!TYPES.has(type))throw new TypeError('Invalid journal event');
    const next={cursor:++record.cursor,type,at:this.now()};
    if(REASONS.has(reason))next.reason=reason;
    record.events.push(next);
    if(record.events.length>this.maxEvents)record.events.shift();
  }
  #observe(session,terminal) {
    if(!session?.id || typeof session.id!=='string')return;
    let rec=this.entries.get(session.id);
    if(!rec){
      rec={cursor:0,events:[],previous:null};
      this.entries.set(session.id,rec);
      this.#append(rec,'started');
    }
    const prior=rec.previous;
    if(terminal){
      if(TERMINAL.has(session.status) && prior?.status!==session.status)
        this.#append(rec,session.status);
    }else if(prior){
      const oldState=prior.targetTracking?.status;
      const nextState=session.targetTracking?.status;
      if(nextState && nextState!==oldState){
        if(nextState==='tracking')this.#append(rec,oldState==='lost'||oldState==='layout_changed'||oldState==='desktop_unavailable'?'target_restored':'target_acquired');
        else if(nextState==='lost')this.#append(rec,'target_lost',session.targetTracking?.reason);
        else if(nextState==='layout_changed')this.#append(rec,'display_changed');
        else if(nextState==='desktop_unavailable')this.#append(rec,'desktop_unavailable');
        else if(nextState==='manual')this.#append(rec,'tracking_released');
      }else if(nextState==='tracking' && rectangle(prior)!==rectangle(session))this.#append(rec,'target_moved');
      else if(nextState==='lost' && prior.targetTracking?.reason!==session.targetTracking?.reason)
        this.#append(rec,'target_lost',session.targetTracking?.reason);
      if(session.sceneRevision!==prior.sceneRevision && nextState!=='tracking' && nextState!=='manual')
        this.#append(rec,'scene_changed');
    }else if(session.targetTracking?.status==='tracking') this.#append(rec,'target_acquired');
    rec.previous={status:session.status,targetTracking:session.targetTracking ? {...session.targetTracking}:null,
      sceneRevision:session.sceneRevision,annotations:session.annotations?.map(a=>({...a}))};
    // LRU: old sessions cannot hold unbounded data. A live session is always newest.
    this.entries.delete(session.id);this.entries.set(session.id,rec);
    while(this.entries.size>this.maxSessions)this.entries.delete(this.entries.keys().next().value);
  }
  read(id, {after=0,limit=20}={}) {
    if(!Number.isSafeInteger(after)||after<0||!Number.isInteger(limit)||limit<1||limit>32)
      throw new TypeError('Invalid event cursor or limit');
    const rec=this.entries.get(id);
    if(!rec)return {events:[],nextCursor:after,truncated:false};
    const oldest=rec.events[0]?.cursor ?? rec.cursor+1;
    const events=rec.events.filter(x=>x.cursor>after).slice(0,limit).map(x=>({...x}));
    // Clamp future/stale cursors rather than leaving an Agent permanently unable
    // to observe new events after an accidental too-large value.
    const nextCursor=events.at(-1)?.cursor??Math.min(after,rec.cursor);
    return {events,nextCursor,truncated:after<oldest-1,
      more:rec.events.some(x=>x.cursor>nextCursor)};
  }
  recent(limit=12) {
    const rec=[...this.entries.values()].at(-1);
    if(!rec)return [];
    return rec.events.slice(-Math.max(1,Math.min(16,limit))).map(x=>({...x}));
  }
  close(){this.manager.off('show',this.onShow);this.manager.off('change',this.onChange);this.entries.clear();}
}
