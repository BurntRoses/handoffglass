import test from 'node:test';
import assert from 'node:assert/strict';
import {DESKTOP_EVIDENCE_CHECKS,validateDesktopEvidenceRecord} from '../src/desktop-evidence.mjs';

// Schema fixtures only: these are not acceptance records or observed device results.
function fixture(kind='windowsDesktop'){
  return {schemaVersion:1,kind,observedAt:'2026-11-13T15:00:00Z',build:{version:'0.23.0',commit:'a'.repeat(40)},platform:{os:'win32',arch:'x64',version:'Windows 11 24H2'},environment:'physical-desktop',displays:[{id:'primary',physical:true,primary:true,bounds:{x:0,y:0,width:1920,height:1080},scaleFactor:1},...(kind==='multiDisplay'?[{id:'left',physical:true,primary:false,bounds:{x:-2560,y:0,width:2560,height:1440},scaleFactor:1.5}]:[])],checks:Object.fromEntries(DESKTOP_EVIDENCE_CHECKS[kind].map(check=>[check,{result:'passed',observed:`Fixture observation for ${check}.`}])),limitations:[]};
}
test('complete desktop records retain the tested build, platform, displays and observed results',()=>{
  for(const kind of Object.keys(DESKTOP_EVIDENCE_CHECKS))assert.deepEqual(validateDesktopEvidenceRecord(fixture(kind),{kind}),[]);
});
test('a macOS result or headless check cannot establish Windows desktop acceptance',()=>{
  const record=fixture();record.platform.os='darwin';record.environment='headless';
  const errors=validateDesktopEvidenceRecord(record,{kind:'windowsDesktop'});
  assert.ok(errors.some(error=>error.includes('requires win32')));
  assert.ok(errors.some(error=>error.includes('Physical graphical desktop')));
});
test('acceptance cannot omit build identity or replace observations with a pass flag',()=>{
  const record=fixture();delete record.build.commit;delete record.platform.version;delete record.displays;delete record.checks.handoff.observed;
  const errors=validateDesktopEvidenceRecord(record);
  for(const field of ['build.commit','platform.version','displays','checks.handoff.observed'])assert.ok(errors.some(error=>error.includes(field)),field);
});
test('physical multi-display evidence requires multiple real displays and measured layout',()=>{
  const record=fixture('multiDisplay');record.displays[1].physical=false;record.displays[1].bounds.x=0;record.displays[1].scaleFactor=0;
  const errors=validateDesktopEvidenceRecord(record);
  for(const field of ['physical display','negative-coordinate','scaleFactor'])assert.ok(errors.some(error=>error.includes(field)),field);
  record.displays.pop();assert.ok(validateDesktopEvidenceRecord(record).some(error=>error.includes('at least two')));
});
test('missing recovery and failed results cannot establish verified desktop evidence',()=>{
  const record=fixture('multiDisplay');delete record.checks.hotplug;record.checks.scale_change.result='failed';
  const errors=validateDesktopEvidenceRecord(record);
  assert.ok(errors.some(error=>error.includes('checks.hotplug')));
  assert.ok(errors.some(error=>error.includes('checks.scale_change')));
  assert.ok(validateDesktopEvidenceRecord(fixture(),{kind:'multiDisplay'}).some(error=>error.includes('does not match')));
});
test('records reject raw secrets and extra screenshot fields',()=>{
  const record=fixture();record.checks.handoff.observed='password=never-store-this';record.checks.overlay.screenshot='data:image/png;base64,abc';
  const errors=validateDesktopEvidenceRecord(record);
  assert.ok(errors.some(error=>error.includes('sensitive content')));
  assert.ok(errors.some(error=>error.includes('screenshot is not allowed')));
});
