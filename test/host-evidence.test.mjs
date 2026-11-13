import test from 'node:test';
import assert from 'node:assert/strict';
import {validateHostEvidenceMatrix,validateHostEvidenceRecord} from '../src/host-evidence.mjs';

const record={schemaVersion:1,host:'codex',platform:'macos-arm64',hostVersion:'0.167.0',handoffglassVersion:'0.23.0',task:{kind:'settings',summary:'Open a local settings panel',risk:'low'},stages:{guidance:{status:'verified',evidence:'A target was presented before the user acted.'},human_decision:{status:'verified',decision:'completed',evidence:'The user completed the step.'},independent_verification:{status:'verified',result:'verified',evidence:'The host inspected the original application.'},resume:{status:'verified',nextAction:'resumed',evidence:'The task continued after verification.'}},result:'completed',limitations:[]};

test('complete evidence requires all four stages and bounded summaries',()=>assert.deepEqual(validateHostEvidenceRecord(record),[]));
test('verified evidence cannot be promoted from an inconclusive check',()=>{
 const bad=structuredClone(record);bad.stages.independent_verification.result='inconclusive';
 assert.ok(validateHostEvidenceRecord(bad).some(error=>error.toLowerCase().includes('inconclusive')));
});
test('resume evidence must record the continuation action',()=>{
 const bad=structuredClone(record);delete bad.stages.resume.nextAction;
 assert.ok(validateHostEvidenceRecord(bad).some(error=>error.includes('resume.nextAction')));
});
test('sensitive fields are rejected even when a record otherwise looks complete',()=>{
 const bad=structuredClone(record);bad.stages.guidance.screenshot='data:image/png;base64,abc';
 assert.ok(validateHostEvidenceRecord(bad).some(error=>error.includes('not allowed')));
});
test('raw secret text is rejected instead of silently accepted in a public record',()=>{
 const bad=structuredClone(record);bad.stages.guidance.evidence='Bearer sk-'+ 'x'.repeat(24);
 assert.ok(validateHostEvidenceRecord(bad).some(error=>error.includes('sensitive content')));
});
test('raw credential-like summaries are rejected instead of being persisted',()=>{
 const bad=structuredClone(record);bad.task.summary='password=never-store-this';
 assert.ok(validateHostEvidenceRecord(bad).some(error=>error.includes('sensitive content')));
});
test('matrix requires every supported host and a record for verified status',()=>{
 const matrix={schemaVersion:1,requiredStages:['guidance','human_decision','independent_verification','resume'],hosts:Object.fromEntries(['codex','claude-code','deepseek','workbuddy','cursor','trae','opencode'].map(host=>[host,{status:'unverified',record:null}]))};
 assert.deepEqual(validateHostEvidenceMatrix(matrix),[]);matrix.hosts.codex.status='verified';assert.ok(validateHostEvidenceMatrix(matrix).some(error=>error.includes('Verified host')));
});
