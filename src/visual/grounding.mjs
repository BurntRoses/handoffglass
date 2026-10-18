/** Future AX/UIA/DOM adapters return candidates in this *strictly grounded* contract.
 * This module never enumerates apps, captures screens or clicks controls.
 */
import { contains, validDisplay } from '../geometry.mjs';
const SOURCES = Object.freeze(['accessibility', 'uia', 'dom', 'manual']);
export class GroundingError extends Error {
  constructor(code, message) { super(message); this.name = 'GroundingError'; this.code = code; }
}
const fail = (code, message) => { throw new GroundingError(code,message); };
const isObj = obj => obj !== null && typeof obj === 'object' && !Array.isArray(obj);
function validateBounds(bounds) {
  if (!isObj(bounds) || ![bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite) ||
      bounds.width <= 0 || bounds.height <= 0 || bounds.width > 20000 || bounds.height > 20000 ||
      Math.abs(bounds.x)>100000 || Math.abs(bounds.y)>100000) fail('invalid_bounds','Candidate must include finite global DIP rectangle');
  return {x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height};
}
function nonempty(value, max, field) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > max) fail('invalid_candidate',`${field} must be a nonempty string`);
  return value.trim();
}
/** Parse data from an already authorized and explicitly consented grounding provider. */
export function normalizeCandidate(input) {
  if (!isObj(input) || !SOURCES.includes(input.source)) fail('invalid_candidate','Source must be accessibility, uia, dom or manual');
  if (input.coordinateSpace !== 'global_DIP') fail('invalid_coordinate_space','No guessed screenshot-pixel conversion');
  if (!Number.isSafeInteger(input.observedAt) || input.observedAt < 0) fail('invalid_candidate','observedAt must be a timestamp in milliseconds');
  return {
    app:nonempty(input.app,128,'app'), role:nonempty(input.role,80,'role'),name:nonempty(input.name,256,'name'),
    bounds:validateBounds(input.bounds), observedAt:input.observedAt, source:input.source,
    coordinateSpace:'global_DIP', enabled:input.enabled === true, visible:input.visible === true,
    occluded:input.occluded === false ? false : true
  };
}
/** Fail closed on stale, ambiguous, invisible or offscreen candidates, not just first match. */
export function resolveGroundedTarget(query, candidates, { now = Date.now(), maxAgeMs = 2000, displays = [] } = {}) {
  if (!isObj(query)) fail('invalid_query','Missing target query');
  const app=nonempty(query.app,128,'app');
  const role=nonempty(query.role,80,'role');
  const name=nonempty(query.name,256,'name');
  if (!Array.isArray(candidates) || candidates.length>64 || !Array.isArray(displays) || !displays.length || !displays.every(validDisplay))
    fail('invalid_candidates','Up to 64 candidates and current validated displays are required');
  if (!Number.isSafeInteger(now) || !Number.isFinite(maxAgeMs) || maxAgeMs < 1 || maxAgeMs > 10000) fail('invalid_query','Invalid observation window');
  const matches=candidates.map(normalizeCandidate).filter(item => item.app===app && item.role===role && item.name===name);
  if (!matches.length) fail('not_found','No exact UI element match');
  // Do not silently discard extra elements: duplicate names should be resolved by the caller.
  if (matches.length>1) fail('ambiguous','Multiple matching UI controls; obtain more context');
  const item=matches[0];
  if (item.observedAt > now || now-item.observedAt>maxAgeMs) fail('stale','Grounded UI bounds are too old; re-observe');
  if (!item.enabled || !item.visible || item.occluded) fail('not_interactable','Target disabled, hidden or not provably unobstructed');
  const point={x:item.bounds.x+item.bounds.width/2,y:item.bounds.y+item.bounds.height/2};
  if (!displays.some(d=>contains(d,point))) fail('offscreen','Target center outside the connected displays');
  return { ...point, width:item.bounds.width, height:item.bounds.height, source:item.source, observedAt:item.observedAt, coordinateSpace:'global_DIP' };
}
