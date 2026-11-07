import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../assets/ruffneck-catalog.reference.json' with { type: 'json' };
import {
  NEED_CATEGORIES, validateOpportunity, recommendProducts, canMoveStage, getNextStages,
  assertRecommendationContext, assertFollowUpConsent, validateFollowUp, redactSalesSummary
} from '../js/sales-desk-engine.js';

test('portfolio reference contains all six RuffNeck products', () => {
  assert.deepEqual(catalog.products.map(item => item.id).sort(), ['kano-keke','kano-run','ruffneck-connect','ruffneck-learn','ruffneck-prospector','ruffneck-social-hub'].sort());
});

test('need categories are explicit and limited', () => {
  assert.equal(NEED_CATEGORIES.includes('entertainment'), true);
  assert.equal(NEED_CATEGORIES.includes('business_growth'), true);
  assert.equal(NEED_CATEGORIES.length, 10);
});

test('opportunity validation checks department, category, source and summary', () => {
  const value = validateOpportunity({
    department:'Sales and Service Enquiries', allowedDepartments:['Sales and Service Enquiries'],
    needCategory:'business_growth', sourceChannel:'voice', sourceType:'inbound_enquiry',
    needSummary:'Customer wants help finding and organising business leads.'
  });
  assert.equal(value.needCategory,'business_growth');
  assert.throws(() => validateOpportunity({ department:'Technical Support and IT',allowedDepartments:['Sales and Service Enquiries'],needCategory:'business_growth',sourceChannel:'voice',needSummary:'This is a valid enough summary.' }));
  assert.throws(() => validateOpportunity({ department:'Sales and Service Enquiries',allowedDepartments:['Sales and Service Enquiries'],needCategory:'unknown',sourceChannel:'voice',needSummary:'This is a valid enough summary.' }));
});

test('summary redaction removes common sensitive values', () => {
  const result = redactSalesSummary('Customer asked for an update. Email person@example.com and OTP: 123456 phone 08012345678');
  assert.equal(result.includes('person@example.com'),false);
  assert.equal(result.includes('123456'),false);
  assert.equal(result.includes('08012345678'),false);
});

test('product matching recommends directly relevant RuffNeck products', () => {
  assert.deepEqual(recommendProducts(catalog,'business_growth').map(x => x.product.id),['ruffneck-prospector','ruffneck-social-hub']);
  assert.deepEqual(recommendProducts(catalog,'entertainment').map(x => x.product.id),['kano-keke','kano-run'].sort((a,b)=>a.localeCompare(b)));
  assert.equal(recommendProducts(catalog,'technical_support').length,0);
});

test('recommendation cap never exceeds three products', () => {
  assert.ok(recommendProducts(catalog,'cross_platform',99).length <= 3);
});

test('stage transitions follow the defined pipeline', () => {
  assert.equal(canMoveStage('new','discovery'),true);
  assert.equal(canMoveStage('new','referred_to_platform'),false);
  assert.equal(canMoveStage('referred_to_platform','follow_up_due'),true);
  assert.deepEqual(getNextStages('closed_no_interest'),[]);
});

test('proactive cross-selling requires an affirmative marketing consent', () => {
  assert.equal(assertRecommendationContext('customer_requested','not_recorded'),true);
  assert.throws(() => assertRecommendationContext('proactive','not_recorded'));
  assert.equal(assertRecommendationContext('proactive','granted'),true);
});

test('follow-up consent purpose is independent and explicit', () => {
  assert.equal(assertFollowUpConsent('service_contact','granted'),true);
  assert.throws(() => assertFollowUpConsent('marketing','revoked'));
  assert.throws(() => assertFollowUpConsent('marketing','not_recorded'));
});

test('follow-up due date must be future and no more than 90 days away', () => {
  const now = Date.parse('2026-11-07T12:00:00Z');
  const valid = validateFollowUp({ purpose:'service_contact',dueAt:'2026-11-08T12:00:00Z' },now);
  assert.equal(valid.purpose,'service_contact');
  assert.throws(() => validateFollowUp({ purpose:'marketing',dueAt:'2026-11-06T12:00:00Z' },now));
  assert.throws(() => validateFollowUp({ purpose:'marketing',dueAt:'2027-03-01T12:00:00Z' },now));
});
