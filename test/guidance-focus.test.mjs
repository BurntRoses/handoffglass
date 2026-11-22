import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuidanceFocus,quietAnnotations} from '../src/desktop/guidance-focus.mjs';

test('a stationary pointer yields the current grounded step after a dwell',()=>{
  let now=0,point={x:20,y:30};
  const focus=createGuidanceFocus({readPointer:()=>point,now:()=>now});
  const mark={id:'target',shape:'spotlight',x:150,y:180,width:60,height:30,label:'Open settings'};
  const step={id:'one',step:1,status:'awaiting_user',continuous:true,annotations:[mark]};
  assert.equal(focus.update(step),true);
  assert.equal(focus.sample(),false);
  point={x:152,y:182};now=100;
  assert.equal(focus.sample(),false);
  now=300;point={x:20,y:30};assert.equal(focus.sample(),false);
  now=400;point={x:152,y:182};assert.equal(focus.sample(),false);
  now=640;assert.equal(focus.sample(),true);
  assert.deepEqual(quietAnnotations([mark,{shape:'badge'}]),[{...mark,shape:'bracket',label:'',effect:'still',strokeWidth:1.8,opacity:.85}]);
  focus.update({...step,annotations:[{...mark,x:249}]});
  assert.equal(focus.subdued,false);
  assert.equal(focus.update({...step,annotations:[{...mark,scrollDirection:'down'}]}),false);
  assert.equal(focus.update({...step,phase:'blocked'}),false);
});

test('a small target movement uses the new visible bounds for pointer dwell',()=>{
  let now=0;
  const focus=createGuidanceFocus({readPointer:()=>({x:225,y:180}),now:()=>now});
  const mark={id:'target',shape:'box',x:200,y:180,width:28,height:30};
  const step={id:'one',step:1,status:'awaiting_user',continuous:true,annotations:[mark]};
  focus.update(step);assert.equal(focus.sample(),false);
  focus.update({...step,annotations:[{...mark,x:219}]});
  assert.equal(focus.sample(),false);
  now=240;assert.equal(focus.sample(),true);
});
