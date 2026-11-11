(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CalloriaFinanceReconciliationEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '5.9.0';
  const STORAGE_KEY = 'calloria.finance-reconciliation.v59';
  const BILLING_KEY = 'calloria.billing-operations.v58';
  const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR'];
  const LINE_STATUSES = ['Unmatched', 'Matched', 'Classified', 'Ignored'];
  const DEBIT_CLASSES = ['Bank fee', 'Bank charge', 'Tax or withholding', 'Interest debit', 'Transfer out', 'Other debit'];
  const CREDIT_CLASSES = ['Bank interest', 'Internal transfer', 'Other credit', 'Refund received'];

  function clean(value, max = 500) {
    return String(value == null ? '' : value).replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function id(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
  function actor(value, label = 'User') { const v = clean(value, 100); if (v.length < 2) throw new Error(`${label} is required.`); return v; }
  function requiredText(value, label, min = 10, max = 500) { const v = clean(value, max); if (v.length < min) throw new Error(`${label} must contain at least ${min} characters.`); return v; }
  function dateOnly(value, label = 'Date') {
    const v = clean(value, 20);
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null;
    if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== v) throw new Error(`Enter a valid ${label.toLowerCase()}.`);
    return v;
  }
  function iso(value) { const d = value instanceof Date ? value : new Date(value == null ? Date.now() : value); if (Number.isNaN(d.getTime())) throw new Error('Invalid date and time.'); return d.toISOString(); }
  function money(value, currency = 'NGN') {
    const n = Number(value) || 0;
    try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n); }
    catch (_) { return `${currency} ${n.toFixed(2)}`; }
  }
  function round(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
  function validCurrency(value) { if (!CURRENCIES.includes(value)) throw new Error('Choose a supported currency.'); return value; }
  function referenceKey(value) { return clean(value, 160).toUpperCase().replace(/[\s\-_/]+/g, ''); }
  function pushActivity(state, message, at) {
    state.activity.unshift({ id: id('act'), at: iso(at), message: clean(message, 300) });
    state.activity = state.activity.slice(0, 400);
  }
  function createInitialState(now) {
    const at = iso(now);
    const today = at.slice(0, 10);
    return {
      version: VERSION,
      accounts: [{ id: 'BANK-PRIMARY', name: 'Primary operating account', currency: 'NGN', maskedNumber: '•••• 2048', active: true }],
      batches: [],
      lines: [],
      matches: [],
      billingPayments: [],
      closes: [],
      activity: [{ id: 'act-demo', at, message: 'Finance reconciliation workspace loaded. Import v5.8 receipts and a bank statement to begin.' }],
      integration: { billingKey: BILLING_KEY, lastBillingImportAt: null, billingImportCount: 0 },
      settings: { dateToleranceDays: 3, defaultAccountId: 'BANK-PRIMARY' }
    };
  }
  function normaliseState(raw, now) {
    const fresh = createInitialState(now);
    if (!raw || typeof raw !== 'object') return fresh;
    const arr = (key) => Array.isArray(raw[key]) ? raw[key] : fresh[key];
    return {
      ...fresh, ...raw,
      accounts: arr('accounts'), batches: arr('batches'),
      lines: arr('lines').map((x) => ({ ...x, amount: Number(x.amount), status: LINE_STATUSES.includes(x.status) ? x.status : 'Unmatched' })),
      matches: arr('matches'), billingPayments: arr('billingPayments'), closes: arr('closes'), activity: arr('activity'),
      integration: { ...fresh.integration, ...(raw.integration || {}) }, settings: { ...fresh.settings, ...(raw.settings || {}) }
    };
  }
  function load(storage, now) {
    if (!storage || typeof storage.getItem !== 'function') return createInitialState(now);
    try { const raw = JSON.parse(storage.getItem(STORAGE_KEY) || 'null'); return raw ? normaliseState(raw, now) : createInitialState(now); }
    catch (_) { return createInitialState(now); }
  }
  function save(state, storage) { if (!storage || typeof storage.setItem !== 'function') return false; try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch (_) { return false; } }

  // Small RFC-4180-compatible CSV parser, including quoted commas and escaped quotes.
  function parseCsv(text) {
    const input = String(text == null ? '' : text).replace(/^\uFEFF/, '');
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (quoted) {
        if (ch === '"' && input[i + 1] === '"') { cell += '"'; i += 1; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); if (row.some((v) => v.trim() !== '')) rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (quoted) throw new Error('The CSV contains an unterminated quoted field.');
    row.push(cell.replace(/\r$/, '')); if (row.some((v) => v.trim() !== '')) rows.push(row);
    return rows;
  }
  function normaliseHeader(value) { return clean(value, 80).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function mapCsvRow(headers, values, index) {
    const obj = {}; headers.forEach((h, i) => { obj[h] = values[i] == null ? '' : String(values[i]).trim(); });
    const pick = (...names) => { for (const name of names) if (obj[name] != null && obj[name] !== '') return obj[name]; return ''; };
    const rawDate = pick('transactiondate', 'date', 'bookingdate', 'valuedate');
    const date = dateOnly(rawDate, 'Transaction date');
    const currency = validCurrency(pick('currency', 'ccy').toUpperCase() || 'NGN');
    const reference = clean(pick('reference', 'bankreference', 'transactionreference', 'ref', 'externalreference'), 160);
    const description = clean(pick('description', 'narration', 'details', 'transactiondetails', 'memo') || `Statement row ${index + 1}`, 300);
    const debitRaw = pick('debit', 'withdrawal', 'moneyout');
    const creditRaw = pick('credit', 'deposit', 'moneyin');
    const amountRaw = pick('amount', 'transactionamount', 'value');
    let amount;
    if (debitRaw !== '' || creditRaw !== '') {
      const debit = debitRaw === '' ? 0 : Number(debitRaw.replace(/[, ]/g, ''));
      const credit = creditRaw === '' ? 0 : Number(creditRaw.replace(/[, ]/g, ''));
      if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0 || (debit > 0 && credit > 0)) throw new Error(`Row ${index + 2}: enter either a debit or a credit, not both.`);
      amount = round(credit - debit);
    } else {
      amount = Number(String(amountRaw).replace(/[ ,]/g, ''));
    }
    if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1e12) throw new Error(`Row ${index + 2}: amount must be a non-zero valid number.`);
    const bankAccount = clean(pick('bankaccount', 'account', 'accountname') || 'Primary operating account', 120);
    const valueDate = pick('valuedate') ? dateOnly(pick('valuedate'), 'Value date') : date;
    return { transactionDate: date, valueDate, currency, amount, reference, description, bankAccount };
  }
  function lineFingerprint(line) {
    return [clean(line.bankAccount, 120).toLowerCase(), line.transactionDate, line.currency, round(line.amount).toFixed(2), referenceKey(line.reference), clean(line.description, 300).toLowerCase()].join('|');
  }
  function isPeriodClosed(state, date) {
    return state.closes.some((close) => close.status === 'Approved' && date >= close.startDate && date <= close.endDate);
  }
  function importStatementCsv(state, csvText, input, at) {
    const who = actor(input && input.importedBy, 'Importer');
    const accountId = clean(input && input.accountId || state.settings.defaultAccountId, 100);
    if (!state.accounts.some((x) => x.id === accountId && x.active)) throw new Error('Choose an active bank account.');
    const rows = parseCsv(csvText); if (rows.length < 2) throw new Error('The statement must contain a header and at least one transaction.');
    const headers = rows[0].map(normaliseHeader);
    const required = ['date', 'transactiondate', 'bookingdate'].some((name) => headers.includes(name));
    const hasAmount = headers.some((name) => ['amount', 'transactionamount', 'value', 'debit', 'credit', 'withdrawal', 'deposit', 'moneyin', 'moneyout'].includes(name));
    if (!required || !hasAmount) throw new Error('CSV needs a transaction date and amount, debit or credit column.');
    const parsed = rows.slice(1).map((values, i) => mapCsvRow(headers, values, i));
    const duplicates = new Set(state.lines.map(lineFingerprint));
    const closeConflicts = parsed.filter((row) => isPeriodClosed(state, row.transactionDate));
    if (closeConflicts.length) throw new Error('The statement contains transactions inside an approved period close. Reopen the period before importing.');
    const batch = { id: id('batch'), accountId, accountName: state.accounts.find((x) => x.id === accountId).name, importedBy: who, importedAt: iso(at), rowCount: parsed.length, importedCount: 0, duplicateCount: 0, source: clean(input && input.sourceName || 'Uploaded CSV statement', 160), status: 'Imported' };
    parsed.forEach((row) => {
      const fingerprint = lineFingerprint(row);
      if (duplicates.has(fingerprint)) { batch.duplicateCount += 1; return; }
      duplicates.add(fingerprint);
      state.lines.push({ id: id('stmt'), batchId: batch.id, accountId, ...row, status: 'Unmatched', matchedPaymentId: null, matchMethod: null, classification: null, classificationReason: null, classifiedBy: null, reconciledAt: null, demo: false });
      batch.importedCount += 1;
    });
    state.batches.unshift(batch); pushActivity(state, `Statement batch ${batch.id} imported by ${who}: ${batch.importedCount} new rows, ${batch.duplicateCount} duplicates skipped.`, at);
    return batch;
  }
  function syncBillingPayments(state, billingState, at) {
    if (!billingState || !Array.isArray(billingState.payments)) throw new Error('Billing v5.8 payment records are unavailable.');
    const previous = new Map(state.billingPayments.map((p) => [p.id, p]));
    const imported = billingState.payments.map((p) => ({
      id: clean(p.id, 120), reference: clean(p.reference, 160), externalReference: clean(p.externalReference, 160),
      customerId: clean(p.customerId, 120), customerName: clean(p.customerName, 180), currency: p.currency,
      amount: round(p.amount), receivedAt: iso(p.receivedAt || p.recordedAt), demo: !!p.demo,
      allocations: Array.isArray(p.allocations) ? p.allocations : []
    }));
    state.billingPayments = imported.map((row) => ({ ...(previous.get(row.id) || {}), ...row }));
    state.integration.lastBillingImportAt = iso(at); state.integration.billingImportCount = imported.length;
    pushActivity(state, `Imported ${imported.length} receipt records from Billing v5.8.`, at);
    return state.billingPayments.length;
  }
  function getLine(state, value) { return state.lines.find((x) => x.id === value || x.reference === value) || null; }
  function getPayment(state, value) { return state.billingPayments.find((x) => x.id === value || x.reference === value || x.externalReference === value) || null; }
  function paymentMatch(state, paymentId) { return state.matches.find((x) => x.paymentId === paymentId) || null; }
  function lineMatch(state, lineId) { return state.matches.find((x) => x.statementLineId === lineId) || null; }
  function candidateMatches(state, lineOrId) {
    const line = typeof lineOrId === 'string' ? getLine(state, lineOrId) : lineOrId;
    if (!line || line.amount <= 0) return [];
    const ref = referenceKey(line.reference);
    return state.billingPayments.filter((payment) => !paymentMatch(state, payment.id) && payment.currency === line.currency && round(payment.amount) === round(line.amount)).map((payment) => {
      const paymentRefs = [referenceKey(payment.externalReference), referenceKey(payment.reference), referenceKey(payment.id)].filter(Boolean);
      const exact = !!ref && paymentRefs.includes(ref);
      const dateDays = Math.abs(new Date(`${line.transactionDate}T00:00:00Z`) - new Date(iso(payment.receivedAt).slice(0, 10) + 'T00:00:00Z')) / 86400000;
      return { payment, exactReference: exact, dateDays, confidence: exact ? 'Exact reference + amount' : dateDays <= Number(state.settings.dateToleranceDays || 3) ? 'Amount/currency/date suggestion' : 'Amount/currency only' };
    }).sort((a, b) => Number(b.exactReference) - Number(a.exactReference) || a.dateDays - b.dateDays);
  }
  function autoMatchExactReferences(state, input, at) {
    const who = actor(input && input.matchedBy, 'Matcher'); let matched = 0; let ambiguous = 0;
    state.lines.filter((line) => line.status === 'Unmatched' && line.amount > 0).forEach((line) => {
      const candidates = candidateMatches(state, line).filter((x) => x.exactReference);
      if (candidates.length === 1) {
        const payment = candidates[0].payment;
        state.matches.push({ id: id('match'), statementLineId: line.id, paymentId: payment.id, statementReference: line.reference, paymentReference: payment.reference, amount: line.amount, currency: line.currency, method: 'Exact reference + amount', matchedBy: who, matchedAt: iso(at), demo: !!line.demo || !!payment.demo });
        line.status = 'Matched'; line.matchedPaymentId = payment.id; line.matchMethod = 'Exact reference + amount'; line.reconciledAt = iso(at); matched += 1;
      } else if (candidates.length > 1) ambiguous += 1;
    });
    pushActivity(state, `Exact-reference auto-match by ${who}: ${matched} matched, ${ambiguous} ambiguous lines left for review.`, at);
    return { matched, ambiguous };
  }
  function manualMatch(state, lineId, paymentId, input, at) {
    const line = getLine(state, lineId); const payment = getPayment(state, paymentId);
    if (!line || !payment) throw new Error('Statement line or Billing receipt not found.');
    if (line.status !== 'Unmatched' || line.amount <= 0) throw new Error('Only unmatched bank credits can be linked to receipts.');
    if (paymentMatch(state, payment.id)) throw new Error('This receipt is already matched to another statement line.');
    if (line.currency !== payment.currency || round(line.amount) !== round(payment.amount)) throw new Error('Manual matching requires an exact currency and amount match. Investigate fees or split settlements separately.');
    const who = actor(input && input.matchedBy, 'Matcher'); const reason = requiredText(input && input.reason, 'Manual match reason', 20, 500);
    const match = { id: id('match'), statementLineId: line.id, paymentId: payment.id, statementReference: line.reference, paymentReference: payment.reference, amount: line.amount, currency: line.currency, method: 'Manual with explanation', matchedBy: who, reason, matchedAt: iso(at), demo: !!line.demo || !!payment.demo };
    state.matches.push(match); line.status = 'Matched'; line.matchedPaymentId = payment.id; line.matchMethod = match.method; line.reconciledAt = iso(at);
    pushActivity(state, `${line.reference || line.id} manually matched to ${payment.reference} by ${who}.`, at); return match;
  }
  function classifyLine(state, lineId, input, at) {
    const line = getLine(state, lineId); if (!line) throw new Error('Statement line not found.');
    if (line.status !== 'Unmatched') throw new Error('Only unmatched statement lines can be classified.');
    const classes = line.amount < 0 ? DEBIT_CLASSES : CREDIT_CLASSES;
    if (!classes.includes(input && input.classification)) throw new Error('Choose a valid classification for the transaction direction.');
    const who = actor(input && input.classifiedBy, 'Classifier'); const reason = requiredText(input && input.reason, 'Classification evidence', 15, 500);
    line.status = 'Classified'; line.classification = input.classification; line.classificationReason = reason; line.classifiedBy = who; line.reconciledAt = iso(at);
    pushActivity(state, `${line.reference || line.id} classified as ${line.classification} by ${who}.`, at); return line;
  }
  function ignoreLine(state, lineId, input, at) {
    const line = getLine(state, lineId); if (!line) throw new Error('Statement line not found.');
    if (line.status !== 'Unmatched') throw new Error('Only unmatched lines can be ignored.');
    const who = actor(input && input.ignoredBy, 'Reviewer'); const reason = requiredText(input && input.reason, 'Ignore reason', 20, 500);
    line.status = 'Ignored'; line.classification = 'Approved exclusion'; line.classificationReason = reason; line.classifiedBy = who; line.reconciledAt = iso(at);
    pushActivity(state, `${line.reference || line.id} excluded from reconciliation by ${who}; evidence recorded.`, at); return line;
  }
  function isPaymentMatched(state, paymentId) { return !!paymentMatch(state, paymentId); }
  function periodSummary(state, billingState, startDate, endDate) {
    const start = dateOnly(startDate, 'Start date'); const end = dateOnly(endDate, 'End date'); if (end < start) throw new Error('Period end date must be on or after the start date.');
    const lines = state.lines.filter((x) => x.transactionDate >= start && x.transactionDate <= end);
    const payments = state.billingPayments.filter((x) => { const day = iso(x.receivedAt).slice(0, 10); return day >= start && day <= end; });
    const unmatchedLines = lines.filter((x) => x.status === 'Unmatched');
    const unmatchedReceipts = payments.filter((x) => !isPaymentMatched(state, x.id));
    const blockers = [];
    if (!state.integration.lastBillingImportAt) blockers.push('Billing v5.8 receipt records have not been imported for this workspace.');
    if (lines.length === 0) blockers.push('No bank statement transactions have been imported for this period.');
    if (unmatchedLines.length) blockers.push(`${unmatchedLines.length} bank statement transaction(s) remain unmatched or unclassified.`);
    if (unmatchedReceipts.length) blockers.push(`${unmatchedReceipts.length} Billing receipt(s) have no bank statement match.`);
    const byCurrency = {};
    lines.forEach((line) => { const row = byCurrency[line.currency] || (byCurrency[line.currency] = { credits: 0, debits: 0, matchedCredits: 0, classifiedDebits: 0 }); if (line.amount > 0) { row.credits = round(row.credits + line.amount); if (line.status === 'Matched') row.matchedCredits = round(row.matchedCredits + line.amount); } else { row.debits = round(row.debits + Math.abs(line.amount)); if (line.status === 'Classified' || line.status === 'Ignored') row.classifiedDebits = round(row.classifiedDebits + Math.abs(line.amount)); } });
    return { startDate: start, endDate: end, lineCount: lines.length, matchedLines: lines.filter((x) => x.status === 'Matched').length, classifiedLines: lines.filter((x) => x.status === 'Classified').length, ignoredLines: lines.filter((x) => x.status === 'Ignored').length, unmatchedLines: unmatchedLines.length, paymentCount: payments.length, matchedPayments: payments.length - unmatchedReceipts.length, unmatchedPayments: unmatchedReceipts.length, byCurrency, blockers };
  }
  function preparePeriodClose(state, billingState, input, at) {
    const who = actor(input && input.preparedBy, 'Preparer'); const note = requiredText(input && input.note, 'Close note', 12, 500);
    const summary = periodSummary(state, billingState, input && input.startDate, input && input.endDate);
    if (state.closes.some((x) => x.status === 'Approved' && !(summary.endDate < x.startDate || summary.startDate > x.endDate))) throw new Error('This period overlaps an already approved close.');
    if (state.closes.some((x) => x.status === 'Prepared' && x.startDate === summary.startDate && x.endDate === summary.endDate)) throw new Error('A close preparation already exists for this period.');
    const close = { id: id('close'), reference: `FC-${summary.endDate.replace(/-/g, '')}-${String(state.closes.length + 1).padStart(3, '0')}`, ...summary, status: 'Prepared', preparedBy: who, preparedAt: iso(at), note, approvedBy: null, approvedAt: null, reopenedBy: null, reopenedAt: null, reopenReason: null, snapshot: { lineIds: state.lines.filter((x) => x.transactionDate >= summary.startDate && x.transactionDate <= summary.endDate).map((x) => x.id), paymentIds: state.billingPayments.filter((x) => { const day = iso(x.receivedAt).slice(0, 10); return day >= summary.startDate && day <= summary.endDate; }).map((x) => x.id) } };
    state.closes.unshift(close); pushActivity(state, `${close.reference} prepared by ${who}; ${summary.blockers.length} blocker(s).`, at); return close;
  }
  function refreshPeriodClose(state, closeId, at) {
    const close = state.closes.find((x) => x.id === closeId || x.reference === closeId); if (!close) throw new Error('Period close not found.');
    if (close.status !== 'Prepared') throw new Error('Only a prepared period close can be refreshed.');
    const summary = periodSummary(state, null, close.startDate, close.endDate);
    Object.assign(close, summary);
    close.snapshot = {
      lineIds: state.lines.filter((x) => x.transactionDate >= close.startDate && x.transactionDate <= close.endDate).map((x) => x.id),
      paymentIds: state.billingPayments.filter((x) => { const day = iso(x.receivedAt).slice(0, 10); return day >= close.startDate && day <= close.endDate; }).map((x) => x.id)
    };
    close.refreshedAt = iso(at); pushActivity(state, `${close.reference} checklist refreshed; ${close.blockers.length} blocker(s) remain.`, at); return close;
  }
  function approvePeriodClose(state, closeId, input, at) {
    const close = state.closes.find((x) => x.id === closeId || x.reference === closeId); if (!close) throw new Error('Period close not found.');
    if (close.status !== 'Prepared') throw new Error('Only a prepared period close can be approved.');
    const latest = periodSummary(state, null, close.startDate, close.endDate);
    if (latest.blockers.length) throw new Error('Resolve all reconciliation blockers and refresh the close checklist before approval.');
    Object.assign(close, latest);
    const who = actor(input && input.approvedBy, 'Approver');
    if (who.toLowerCase() === close.preparedBy.toLowerCase()) throw new Error('Period close approval requires a different person from the preparer.');
    close.status = 'Approved'; close.approvedBy = who; close.approvedAt = iso(at); pushActivity(state, `${close.reference} approved by ${who}; statement period locked in this browser workspace.`, at); return close;
  }
  function reopenPeriodClose(state, closeId, input, at) {
    const close = state.closes.find((x) => x.id === closeId || x.reference === closeId); if (!close) throw new Error('Period close not found.');
    if (close.status !== 'Approved') throw new Error('Only an approved period close can be reopened.');
    const who = actor(input && input.reopenedBy, 'Reopener'); const reason = requiredText(input && input.reason, 'Reopen reason', 20, 500);
    if (who.toLowerCase() === close.approvedBy.toLowerCase()) throw new Error('Reopening requires a person other than the approver.');
    close.status = 'Reopened'; close.reopenedBy = who; close.reopenedAt = iso(at); close.reopenReason = reason; pushActivity(state, `${close.reference} reopened by ${who}: ${reason}`, at); return close;
  }
  function buildDashboard(state, billingState) {
    const matched = state.lines.filter((x) => x.status === 'Matched').length;
    const classified = state.lines.filter((x) => x.status === 'Classified' || x.status === 'Ignored').length;
    const unmatchedLines = state.lines.filter((x) => x.status === 'Unmatched').length;
    const unmatchedReceipts = state.billingPayments.filter((x) => !isPaymentMatched(state, x.id)).length;
    const sums = {};
    state.lines.forEach((line) => { const s = sums[line.currency] || (sums[line.currency] = { credits: 0, debits: 0 }); if (line.amount > 0) s.credits = round(s.credits + line.amount); else s.debits = round(s.debits + Math.abs(line.amount)); });
    return { statementLines: state.lines.length, matched, classified, unmatchedLines, billingReceipts: state.billingPayments.length, unmatchedReceipts, openCloses: state.closes.filter((x) => x.status === 'Prepared').length, approvedCloses: state.closes.filter((x) => x.status === 'Approved').length, batches: state.batches.length, byCurrency: sums };
  }
  function toCsv(rows, columns) {
    const cell = (value) => { let s = String(value == null ? '' : value); if (/^[\s]*[=+@-]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
    return [columns.map((c) => cell(c.label)).join(','), ...rows.map((r) => columns.map((c) => cell(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(','))].join('\r\n');
  }
  return {
    VERSION, STORAGE_KEY, BILLING_KEY, CURRENCIES, LINE_STATUSES, DEBIT_CLASSES, CREDIT_CLASSES,
    clean, iso, money, dateOnly, parseCsv, load, save, createInitialState, normaliseState, importStatementCsv, syncBillingPayments,
    getLine, getPayment, candidateMatches, autoMatchExactReferences, manualMatch, classifyLine, ignoreLine,
    periodSummary, preparePeriodClose, refreshPeriodClose, approvePeriodClose, reopenPeriodClose, buildDashboard, isPeriodClosed, toCsv
  };
});
