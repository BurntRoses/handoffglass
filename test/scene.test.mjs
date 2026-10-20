import test from 'node:test';
import assert from 'node:assert/strict';
import { HandoffManager, normalizeRequest } from '../src/core.mjs';
import { SCENE_VERSION, EFFECTS, normalizeAnnotation, SHAPES, TONES, TEMPLATE_NAMES, composeTemplate, normalizeScene, flattenScene, patchScene } from '../src/visual/scene.mjs';
const target = { x: -250, y: 340, width: 124, height: 42, label: 'Review permissions' };
const basic = { title:'Sample',message:'User controls target'};
const source = () => ({ version:1,layers:[
  {id:'background',zIndex:-10,annotations:[{id:'focus_1',x:10,y:20,shape:'spotlight'}]},
  {id:'labels',zIndex:10,opacity:.6,annotations:[{id:'label_1',x:10,y:20,shape:'arrow',tone:'caution',opacity:.5,label:'Confirm'}]}
]});
test('template catalogue renders meaningful, strictly bounded reusable marks', () => {
  assert.equal(SCENE_VERSION, 1);
  assert.equal(TEMPLATE_NAMES.length,9);
  assert.equal(SHAPES.length,13);
  for (const name of TEMPLATE_NAMES) {
    const s=composeTemplate(name,[target]);
    assert.equal(s.version,1);
    assert.equal(flattenScene(s).length>=1,true);
    assert.equal(flattenScene(s)[0].x,-250);
  }
  const multi=composeTemplate('sequence',[target,{...target,x:300,label:'Step two'}]);
  assert.equal(flattenScene(multi).filter(m=>m.shape==='badge').map(m=>m.label).join(','),'1,2');
  assert.equal(flattenScene(composeTemplate('caution',[target]))[0].color,TONES.caution);
  assert.equal(flattenScene(composeTemplate('sequence',[{...target,width:600,height:40}]))[0].shape,'bracket');
  assert.throws(()=>composeTemplate('focus',[]),/1–8/);
  assert.throws(()=>composeTemplate('unknown',[target]),/Unknown/);
});
test('scene normalization orders layers stably, multiplies alpha, hides invisible layers', () => {
  const s=normalizeScene(source());
  const visible=flattenScene(s);
  assert.deepEqual(visible.map(m=>m.layerId),['background','labels']);
  assert.equal(visible[1].opacity,.3);
  assert.equal(visible[0].id,'focus_1');
  s.layers[0].annotations[0].label='mutated';
  assert.notEqual(flattenScene(source())[0].label,'mutated');
  const hidden=patchScene(source(),[{op:'set_layer',layerId:'background',visible:false}]);
  assert.deepEqual(flattenScene(hidden).map(m=>m.layerId),['labels']);
});
test('patches are atomic, support update/remove/reorder, and do not mutate input', () => {
  const original=source();
  const next=patchScene(original,[
    {op:'upsert_annotation',layerId:'labels',annotation:{id:'label_2',x:75,y:80,shape:'underline'}},
    {op:'set_layer',layerId:'labels',zIndex:-20},
    {op:'remove_annotation',layerId:'background',annotationId:'focus_1'}
  ]);
  assert.equal(original.layers[1].annotations.length,1);
  assert.equal(next.layers[1].annotations.length,2);
  assert.equal(flattenScene(next)[0].id,'label_1');
  assert.equal(flattenScene(next).length,2);
  assert.throws(()=>patchScene(source(),[{op:'set_layer',layerId:'labels',opacity:0.8},{op:'remove_layer',layerId:'notfound'}]),/Layer not found/);
  assert.equal(original.layers[1].opacity,.6);
  assert.equal(patchScene(source(),[{op:'remove_layer',layerId:'background'}]).layers.length,1);
  assert.equal(patchScene(source(),[{op:'upsert_layer',layer:{id:'extra',annotations:[]}}]).layers.length,3);
});
test('invalid shape, identifiers, opacity, repeated ids and excessive scene complexity are rejected',()=>{
  assert.throws(()=>normalizeScene({version:99,layers:[]}),/version/);
  assert.throws(()=>normalizeScene({version:1,layers:[{id:'dup'},{id:'dup'}]}),/Duplicate layer/);
  assert.throws(()=>normalizeScene({version:1,layers:[{id:'one',annotations:[{id:'same',x:0,y:0},{id:'same',x:0,y:0}]}]}),/Duplicate annotation/);
  assert.throws(()=>normalizeScene({version:1,layers:[{id:'bad spaces',annotations:[]}]}),/Invalid layer/);
  assert.throws(()=>normalizeScene({version:1,layers:[{id:'good',opacity:1.5}]}),/opacity/);
  assert.throws(()=>normalizeScene({version:1,layers:[{id:'one',annotations:Array(25).fill({x:0,y:0})}]}),/at most 24/);
  assert.throws(()=>normalizeScene({version:1,layers:[{id:'one',annotations:[{x:1,y:2,shape:'unsafe-html'}]}]}),/shape/);
  assert.throws(()=>normalizeRequest({...basic, mode:'guide',scene:source(),annotations:[]}),/Choose scene/);
  assert.throws(()=>normalizeRequest({...basic, mode:'guide',template:'focus'}),/grounded/);
});
test('live scene patch is optimistic, owner scoped, and does not reset expiry',()=>{
  let now=1000;
  const manager=new HandoffManager({clock:()=>now});
  let showCount=0; manager.on('show',()=>showCount++);
  const session=manager.show({...basic, mode:'guide', scene:source(), timeoutSeconds:30},'agent-a');
  assert.equal(session.sceneRevision,1);
  assert.equal(manager.updateScene(session.id,'agent-b',1,[{op:'remove_layer',layerId:'labels'}]).error,'not_found');
  assert.equal(manager.updateScene(session.id,'agent-a',2,[{op:'remove_layer',layerId:'labels'}]).error,'revision_conflict');
  now=2000;
  const res=manager.updateScene(session.id,'agent-a',1,[{op:'set_layer',layerId:'labels',visible:false}]);
  assert.equal(res.session.sceneRevision,2);
  assert.equal(res.session.timeoutAt,31000);
  assert.equal(showCount,2);
  assert.equal(manager.get(session.id).scene.layers[1].visible,false);
  res.session.scene.layers[1].visible=true;
  assert.equal(manager.get(session.id).scene.layers[1].visible,false);
  assert.throws(()=>manager.updateScene(session.id,'agent-a',2,[{op:'remove_layer',layerId:'missing'}]),/Layer not found/);
  manager.resolve(session.id,'completed','agent-a');
  assert.equal(manager.updateScene(session.id,'agent-a',2,[{op:'set_layer',layerId:'labels',visible:true}]).error,'already_final');
  manager.close();
});
test('legacy sessions are not silently converted to mutable scenes',()=>{
  const manager=new HandoffManager();const s=manager.show({...basic,mode:'guide',x:10,y:15});
  assert.equal(manager.updateScene(s.id,'local',1,[{op:'set_layer',layerId:'foo',visible:false}]).error,'scene_not_enabled');
  manager.close();
});

test('animation hints survive normalization, flattening and atomic updates with bounded timing',()=>{
  for(const effect of EFFECTS){
    const a=normalizeAnnotation({...target,shape:'scribble',effect,delayMs:420,durationMs:1100});
    const scene={version:1,layers:[{id:'ink',annotations:[{...a,id:'mark'}]}]};
    const updated=patchScene(scene,[{op:'upsert_annotation',layerId:'ink',annotation:{...a,id:'mark',x:75}}]);
    assert.deepEqual(flattenScene(updated)[0],{...a,id:'mark',x:75,layerId:'ink',zIndex:0,opacity:1});
    assert.equal(flattenScene(scene)[0].x,target.x);
  }
  for(const props of [{effect:'spin'},{delayMs:-1},{delayMs:5001},{durationMs:199},{durationMs:4001},{durationMs:Infinity}])
    assert.throws(()=>normalizeAnnotation({...target,...props}),/effect|delayMs|durationMs/);
  const steps=flattenScene(composeTemplate('sequence',[target,{...target,x:300}]));
  assert.deepEqual(steps.filter(a=>a.shape==='ring').map(a=>a.delayMs),[0,420]);
  assert.deepEqual(steps.filter(a=>a.shape==='badge').map(a=>[a.width,a.height]),[[124,42],[124,42]]);
});
