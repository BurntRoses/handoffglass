import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionHint,connectionFailure,formatHostLauncher,connectionRuntimeHint} from '../src/desktop/host-connections.mjs';

test('connection hints preserve actual verification, disabled state and recovery action',()=>{
  assert.match(connectionHint({installed:true,hostVerified:true,launchCommand:['node','launch.mjs']}),/真实调用/);
  assert.match(connectionHint({installed:true,enabled:false,launchCommand:['node','launch.mjs']}),/停用/);
  assert.match(connectionHint({installed:true,nextAction:'review_configuration'}),/配置已被修改/);
  assert.match(connectionFailure('cancelled'),/配置未写入/);
  assert.match(connectionFailure('host_install_failed','en-US'),/rollback/);
  assert.match(connectionRuntimeHint({runtimeMode:'app-linked'}),/使用已安装/);
  assert.match(connectionRuntimeHint({runtimeMode:'app-linked'},'en-US'),/installed HandoffGlass App/);
  assert.equal(connectionRuntimeHint({runtimeMode:'embedded'}),'');
});

test('launcher copy preserves arguments in shell syntax and rejects malformed commands',()=>{
  const state={launchCommand:['/test/Node runtime',"/test/user's plugin/launch.mjs"]};
  assert.equal(formatHostLauncher(state),"'/test/Node runtime' '/test/user'\\''s plugin/launch.mjs'");
  assert.equal(formatHostLauncher(state,'win32'),"& '/test/Node runtime' '/test/user''s plugin/launch.mjs'");
  assert.equal(formatHostLauncher({...state,launchEnv:{ELECTRON_RUN_AS_NODE:'1'}}),"env ELECTRON_RUN_AS_NODE=1 '/test/Node runtime' '/test/user'\\''s plugin/launch.mjs'");
  const powershell=formatHostLauncher({...state,launchEnv:{ELECTRON_RUN_AS_NODE:'1'}},'win32');
  assert.match(powershell,/try \{ \$env:ELECTRON_RUN_AS_NODE='1'; & /);
  assert.match(powershell,/finally \{ \$env:ELECTRON_RUN_AS_NODE=\$hgLaunchNode \}/);
  assert.equal(formatHostLauncher({launchCommand:['node','bad\ncommand']}),'');
  assert.equal(formatHostLauncher({launchCommand:'node launch.mjs'}),'');
});
