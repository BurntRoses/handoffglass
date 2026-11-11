import test from 'node:test';
import assert from 'node:assert/strict';
import {panelState} from '../src/desktop/panel-state.mjs';
const now=100000,base={status:'awaiting_user',phase:'waiting_user',execution:'attached'};
test('waiting and parked sessions never impersonate model activity',()=>{
  assert.equal(panelState(base,now).key,'waiting');
  for(const phase of ['thinking','observing','presenting','verifying']) {
    const s={...base,agentState:{phase,at:now-1000}};
    assert.equal(panelState(s,now).working,true);
    assert.equal(panelState({...s,execution:'parked'},now).working,false);
    assert.equal(panelState(s,now+30001).working,false);
  }
  assert.equal(panelState({...base,agentState:{phase:'thinking',at:now+1}},now).working,false);
});
test('reported action, pause, lost target and disconnection have distinct feedback',()=>{
  assert.equal(panelState({...base,phase:'verifying'},now).key,'submitted');
  assert.equal(panelState({...base,phase:'verifying',execution:'parked'},now).key,'parkedSubmitted');
  assert.equal(panelState({...base,status:'paused'},now).key,'paused');
  assert.equal(panelState({...base,phase:'blocked'},now).key,'lost');
  assert.equal(panelState({...base,phase:'blocked',targetTracking:{reason:'permission_denied'}},now).key,'permission');
  assert.equal(panelState({...base,desktopConnection:'reconnecting'},now).working,false);
});
