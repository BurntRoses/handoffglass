import test from 'node:test';
import assert from 'node:assert/strict';
import { assessHandoff, GROUNDING_EVIDENCE } from '../src/local/policy.mjs';
import { BLUEPRINT_NAMES } from '../src/local/blueprints.mjs';

test('every scenario and evidence state is safe and requires downstream verification', () => {
  for (const blueprint of BLUEPRINT_NAMES) for (const evidence of GROUNDING_EVIDENCE) {
    const result = assessHandoff({ blueprint, evidence });
    assert.equal(result.verification, 'independent_check_required');
    assert.equal(result.neverAutoApprove, true);
    assert.equal(result.reportIsNotVerification, true);
    assert.equal(result.localModelCalls, 0);
    assert.equal(result.coordinateFree, !['global_dip', 'accessibility'].includes(evidence));
    assert.equal(result.nextTool, result.risk === 'normal' && !result.coordinateFree ? 'visual_show' : 'handoff_request');
    assert.equal(result.template === null, result.coordinateFree);
  }
});
test('ambiguous and stale targets must never turn into guessed coordinates', () => {
  for (const evidence of ['ambiguous','stale','offscreen']) {
    const result = assessHandoff({ blueprint:'general', evidence, locale:'en-US' });
    assert.equal(result.coordinateFree, true);
    assert.equal(result.grounding, 'unreliable');
    assert.match(result.reason, /never draw/);
  }
});
test('permission, authentication and destructive choices remain human-owned even with exact coordinates', () => {
  for (const blueprint of ['authorization','authentication','destructive_action','system_settings']) {
    const result = assessHandoff({ blueprint,evidence:'accessibility' });
    assert.equal(result.nextTool,'handoff_request');
    assert.equal(result.userDecides,true);
    assert.equal(result.coordinateFree,false);
  }
});
test('plans are deterministic and reject unrecognized inputs instead of guessing', () => {
  const args={blueprint:'file_import',evidence:'global_dip',locale:'zh-CN'};
  assert.deepEqual(assessHandoff(args),assessHandoff(args));
  assert.throws(()=>assessHandoff({blueprint:'permission-bypass'}), /Unknown blueprint/);
  assert.throws(()=>assessHandoff({blueprint:'general',evidence:'almost certain'}), /Unknown grounding/);
  assert.throws(()=>assessHandoff({blueprint:'general',locale:'fr-FR'}), /Unknown locale/);
});
