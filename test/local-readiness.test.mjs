import test from 'node:test';
import assert from 'node:assert/strict';
import {assessReadiness} from '../src/local/readiness.mjs';
import {desktopRuntimeStatus} from '../src/local/desktop-runtime.mjs';
const facts={nodeMajor:22,platform:'darwin',coreAvailable:true,electronAvailable:true,desktopSession:true,brokerConnected:true,accessibilityOptIn:false};
test('a desktop-ready build is never mistaken for real physical GUI acceptance',()=>{
 const result=assessReadiness(facts);
 assert.equal(result.coreReady,true);
 assert.equal(result.desktopCandidate,true);
 assert.equal(result.desktopVerified,false);
 assert.equal(result.desktopAcceptance,'physical_GUI_test_required');
});
test('Linux headless supports core but no invented GUI support',()=>{
 const result=assessReadiness({...facts,platform:'linux',electronAvailable:false,desktopSession:false});
 assert.equal(result.coreReady,true);
 assert.equal(result.desktopCandidate,false);
 assert.equal(result.checks.find(x=>x.id==='desktop_platform').status,'limited');
});
test('accessibility remains disabled unless opted in; opt-in alone is not OS consent',()=>{
 const off=assessReadiness(facts);
 const on=assessReadiness({...facts,accessibilityOptIn:true});
 assert.equal(off.checks.find(x=>x.id==='accessibility').status,'disabled');
 assert.equal(on.checks.find(x=>x.id==='accessibility').status,'manual');
});
test('misconfigured core fails fast and input is validated',()=>{
 assert.equal(assessReadiness({...facts,nodeMajor:20}).coreReady,false);
 assert.equal(assessReadiness({...facts,coreAvailable:false}).coreReady,false);
 assert.throws(()=>assessReadiness({}),/Missing trusted/);
});
test('resolving the Electron package does not prove its executable was downloaded',()=>{
 const missing = desktopRuntimeStatus({resolvePackage:()=>'/package/index.js',loadExecutable:()=>{throw new Error('install script blocked');}});
 assert.equal(missing.available,false);assert.equal(missing.code,'electron_runtime_missing');
 assert.match(missing.recovery,/install.js/);
 const absent = desktopRuntimeStatus({resolvePackage:()=>{throw new Error('not installed');}});
 assert.equal(absent.code,'electron_not_installed');
 const broken = desktopRuntimeStatus({resolvePackage:()=>'/package/index.js',loadExecutable:()=>'/missing',checkExecutable:()=>{throw new Error('ENOENT');}});
 assert.equal(broken.available,false);
 const ready = desktopRuntimeStatus({resolvePackage:()=>'/package/index.js',loadExecutable:()=>'/electron',checkExecutable:()=>{}});
 assert.equal(ready.available,true);
});
