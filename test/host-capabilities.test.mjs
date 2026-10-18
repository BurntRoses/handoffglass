import test from 'node:test';
import assert from 'node:assert/strict';
import {HOST_CAPABILITIES,hostStrategy} from '../src/hosts/capabilities.mjs';
import {HOSTS,hostConfig} from '../src/config.mjs';
test('every configured host has a capabilities record and valid config',()=>{
 for(const host of Object.keys(HOSTS)){assert.equal(hostStrategy(host).viable,true);assert.ok(HOST_CAPABILITIES[host]);assert.ok(hostConfig(host).includes('handoffglass'));
  if(host !== 'codex') JSON.parse(hostConfig(host));}
});
test('unsupported and remote surfaces explicitly fail closed',()=>{
 assert.equal(hostStrategy('doubao-app').viable,false);
 assert.equal(hostStrategy('workbuddy',{remote:true}).viable,false);
});
