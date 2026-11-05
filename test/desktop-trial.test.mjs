import test from 'node:test';
import assert from 'node:assert/strict';
import { HandoffManager } from '../src/core.mjs';
import { startDesktopTrial } from '../src/local/desktop-trial.mjs';

const flush = () => new Promise(resolve => setImmediate(resolve));
test('local trial keeps one three-step session, recovers the same step, and does not checkpoint a demo', async () => {
  const manager = new HandoffManager();
  const trial = startDesktopTrial(manager, {locale:'zh-CN'}, [{id:'left',x:-1000,y:0,width:1000,height:800}]);
  try {
    const {id} = trial.session;
    assert.equal(trial.session.demo, true);
    assert.equal(trial.session.totalSteps, 3);
    assert.equal(trial.session.annotations[0].x, -500);
    assert.equal(manager.exportCheckpoint(), null);
    manager.control(id,null,'pause');manager.control(id,null,'resume');await flush();
    assert.equal(manager.active().step, 1);
    for (let step=1;step<=3;step++) {
      assert.equal(manager.active().id, id);
      assert.equal(manager.active().step, step);
      manager.resolve(id,'completed');await flush();
    }
    assert.equal(manager.get(id).status, 'completed');
    assert.equal(manager.active(), null);
  } finally { trial.dispose();manager.close(); }
});

test('trial does not replace or verify another owner’s workflow', async () => {
  const manager=new HandoffManager();
  try {
    const real=manager.show({title:'Real task',message:'Check external app',continuous:true},'agent');
    const trial=startDesktopTrial(manager,{locale:'en-US'});
    assert.equal(trial.session.error,'busy');
    manager.resolve(real.id,'completed');await flush();
    assert.equal(manager.get(real.id).verified,false);
    assert.equal(manager.get(real.id).phase,'verifying');
  } finally {manager.close();}
});
