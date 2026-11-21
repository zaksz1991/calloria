import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformMainV688 } from '../build/calloria-career-development-v6-88.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = fs.readFileSync(path.join(root, 'vite.config.js'), 'utf8');
const fixture = fs.readFileSync(path.join(root, 'tests/fixtures/main-v6.88-anchor-snapshot.js'), 'utf8');

test('Vite removes obsolete v6.42–v6.50 transforms that skip on the current native main.js', () => {
  for (const staleName of [
    'calloriaVoiceResponseWorkflowPlugin', 'calloriaInboundCustomerDialoguePlugin',
    'calloriaInboundConversationWrapUpPlugin', 'calloriaInboundQAReviewBridgePlugin',
    'calloriaQACoachingFollowThroughPlugin', 'calloriaGuidedCoachingPracticePlugin',
    'calloriaCareerCompetencyPassportPlugin', 'calloriaPromotionReadinessDossierPlugin',
    'calloriaScenarioBasedPromotionExamPlugin',
  ]) assert.equal(config.includes(staleName), false, `${staleName} should no longer be registered`);
});

test('Vite retains existing mobile and employment plugins and registers the consolidated career plugin', () => {
  assert.ok(config.includes('calloriaMobileResponsiveRepairPlugin()'));
  assert.ok(config.includes('calloriaFirstWorkingShiftV44Plugin()'));
  assert.ok(config.includes("import { calloriaCareerDevelopmentPluginV688 } from './build/calloria-career-development-v6-88.mjs';"));
  assert.ok(config.includes('calloriaCareerDevelopmentPluginV688()'));
});

test('RuffNeck service integration runs before the career panel transform', () => {
  const service = config.indexOf('calloriaRuffNeckServiceOperationsPluginV686()');
  const career = config.indexOf('calloriaCareerDevelopmentPluginV688()');
  const visitor = config.indexOf('calloriaPublicExperienceHubPlugin()');
  assert.ok(service >= 0 && career > service && visitor > career);
});

test('transformed current-source fixture parses as valid JavaScript', () => {
  const output = transformMainV688(fixture);
  assert.doesNotThrow(() => new vm.Script(output, { filename: 'main-v6.88-transformed.js' }));
});
