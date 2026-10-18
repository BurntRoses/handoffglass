import test from 'node:test';
import assert from 'node:assert/strict';
import {BLUEPRINT_NAMES,compileBlueprint} from '../src/local/blueprints.mjs';
test('all local blueprints require independent downstream verification',()=>{
 for(const n of BLUEPRINT_NAMES){const b=compileBlueprint(n);assert.equal(b.estimatedTokenCost,0);assert.equal(b.steps.length,3);assert.equal(b.verification,'independent_check_required');}
});
test('sensitive blueprints never approve on behalf of user',()=>{
 for(const n of ['authorization','authentication','system_settings','destructive_action']){
  const b=compileBlueprint(n,{locale:'en-US'});assert.equal(b.steps[1].requiresUserDecision,true);assert.match(b.action,/human_controls/);
 }
});
test('rejects invalid locale/unknown scenarios without fallback guess',()=>{
 assert.throws(()=>compileBlueprint('unknown'),/Unknown blueprint/);
 assert.throws(()=>compileBlueprint('general',{locale:'zh'}),/Unknown locale/);
});
