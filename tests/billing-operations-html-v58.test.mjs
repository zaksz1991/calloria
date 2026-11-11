import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../public');
const html = readFileSync(resolve(root, 'billing-operations.html'), 'utf8');
const js = readFileSync(resolve(root, 'billing-operations.js'), 'utf8');
const css = readFileSync(resolve(root, 'billing-operations.css'), 'utf8');
const engine = readFileSync(resolve(root, 'billing-operations-engine.js'), 'utf8');

test('page references the v5.8 stylesheet, engine and controller', () => {
  assert.match(html, /href="\/billing-operations\.css"/);
  assert.match(html, /src="\/billing-operations-engine\.js"/);
  assert.match(html, /src="\/billing-operations\.js"/);
});
test('page static IDs are unique', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size);
});
test('all static ID selectors used by the controller exist in the page', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const selectors = [...js.matchAll(/\$\('#([A-Za-z0-9_-]+)'/g)].map((match) => match[1]);
  const missing = [...new Set(selectors)].filter((id) => !ids.has(id));
  assert.deepEqual(missing, []);
});
test('work area tabs and corresponding panels exist', () => {
  for (const tab of ['overview', 'orders', 'invoices', 'payments', 'controls']) {
    assert.match(html, new RegExp(`data-tab="${tab}"`));
    assert.match(html, new RegExp(`id="tab-${tab}"`));
  }
});
test('order, invoice and receipt forms are present', () => {
  assert.match(html, /id="order-form"/); assert.match(html, /id="invoice-form"/); assert.match(html, /id="payment-form"/);
});
test('control exception lists are present', () => {
  for (const id of ['credits-list', 'disputes-list', 'collections-list', 'refunds-list']) assert.match(html, new RegExp(`id="${id}"`));
});
test('mobile responsive breakpoints are defined', () => {
  assert.match(css, /@media\(max-width:1000px\)/); assert.match(css, /@media\(max-width:700px\)/);
});
test('engine exposes tested order-to-cash and exception control methods', () => {
  for (const method of ['createOrder', 'approveOrder', 'createInvoice', 'issueInvoice', 'recordPayment', 'allocatePayment', 'createCreditNote', 'approveCreditNote', 'createDispute', 'createCollectionAction', 'requestRefund', 'approveRefund', 'settleRefund']) assert.match(engine, new RegExp(`\\b${method}\\b`));
});
test('export controls exist for orders, invoices, receipts and exceptions', () => {
  for (const id of ['export-orders', 'export-invoices', 'export-payments', 'export-controls']) assert.match(html, new RegExp(`id="${id}"`));
});

test('dynamic action form supports invoice selectors for receipt allocation and refund reversal', () => {
  assert.match(js, /field\.type === 'select-payment-invoices'/);
  assert.match(js, /field\.type === 'select-invoices'/);
});
