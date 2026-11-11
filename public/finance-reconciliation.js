(function () {
  'use strict';
  const E = window.CalloriaFinanceReconciliationEngine;
  if (!E) { document.body.innerHTML = '<p style="padding:24px;font:16px sans-serif">Finance reconciliation engine failed to load.</p>'; return; }
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  let state = E.load(window.localStorage);
  let billingState = readBillingState();
  let activeAction = null;
  let toastTimer = null;

  function readBillingState() {
    try { return JSON.parse(localStorage.getItem(E.BILLING_KEY) || 'null'); } catch (_) { return null; }
  }
  function persist() { E.save(state, localStorage); }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function money(value, currency) { return E.money(value, currency); }
  function toast(message, error = false) {
    const node = $('#toast'); node.textContent = message; node.classList.toggle('error', error); node.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 3300);
  }
  function empty(text) { return `<div class="empty">${escapeHtml(text)}</div>`; }
  function statusBadge(status) { return `<span class="status ${String(status).toLowerCase()}">${escapeHtml(status)}</span>`; }
  function download(name, content, type = 'text/csv;charset=utf-8') {
    const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  }
  function dateTime(value) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(); }
  function saveAndRender() { persist(); render(); }
  function readApprovedPeriod(date) { return E.isPeriodClosed(state, date); }

  function renderMetrics() {
    const d = E.buildDashboard(state, billingState);
    $('#m-lines').textContent = d.statementLines; $('#m-batches').textContent = `${d.batches} imported batches`;
    $('#m-matched').textContent = d.matched; $('#m-unmatched-lines').textContent = d.unmatchedLines;
    $('#m-unmatched-payments').textContent = d.unmatchedReceipts; $('#m-closes').textContent = d.openCloses + d.approvedCloses;
    $('#m-approved').textContent = `${d.approvedCloses} approved`;
    const totals = Object.entries(d.byCurrency).map(([currency, x]) => `<span><b>${currency}</b> Credits ${money(x.credits, currency)} · Debits ${money(x.debits, currency)}</span>`);
    $('#currency-totals').innerHTML = totals.join('') || '<span>No statement data imported.</span>';
    $('#billing-state').textContent = state.integration.lastBillingImportAt ? `${state.billingPayments.length} receipts imported` : 'Not imported';
    $('#billing-time').textContent = state.integration.lastBillingImportAt ? `Last refreshed ${dateTime(state.integration.lastBillingImportAt)}` : 'Import receipt records from Billing v5.8 local storage.';
  }
  function renderOverview() {
    const d = E.buildDashboard(state, billingState); const issues = [];
    if (d.unmatchedLines) issues.push(['Bank statement lines awaiting review', `${d.unmatchedLines} unmatched bank entries need a match, classification or evidence-backed exclusion.`, d.unmatchedLines]);
    if (d.unmatchedReceipts) issues.push(['Billing receipts without bank matches', `${d.unmatchedReceipts} v5.8 receipt records have no statement line match.`, d.unmatchedReceipts]);
    if (!state.integration.lastBillingImportAt) issues.push(['Billing source not imported', 'Refresh v5.8 receipt records before preparing a period close.', 1]);
    if (!issues.length) issues.push(['No open reconciliation exceptions', 'All currently imported lines and receipts are accounted for.', 0]);
    $('#attention-list').innerHTML = issues.map((x) => `<div class="record"><div><strong>${escapeHtml(x[0])}</strong><small>${escapeHtml(x[1])}</small></div><span class="count">${x[2]}</span></div>`).join('');
    $('#batch-list').innerHTML = state.batches.slice(0, 7).map((b) => `<div class="record"><div><strong>${escapeHtml(b.source)}</strong><small>${escapeHtml(b.accountName)} · ${dateTime(b.importedAt)}<br>${escapeHtml(b.importedBy)} · ${b.importedCount} imported · ${b.duplicateCount} duplicates</small></div>${statusBadge(b.status)}</div>`).join('') || empty('No statement batches imported.');
  }
  function filteredLines() {
    const query = $('#line-search').value.trim().toLowerCase(); const status = $('#line-status').value; const direction = $('#line-direction').value;
    return [...state.lines].filter((line) => {
      const search = `${line.reference} ${line.description} ${line.amount} ${line.currency} ${line.bankAccount}`.toLowerCase();
      return (!query || search.includes(query)) && (status === 'All' || line.status === status) && (direction === 'All' || (direction === 'Credit' ? line.amount > 0 : line.amount < 0));
    }).sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  }
  function renderLines() {
    const lines = filteredLines();
    $('#lines-body').innerHTML = lines.map((line) => {
      const match = state.matches.find((x) => x.statementLineId === line.id);
      let action = '—';
      if (line.status === 'Unmatched' && line.amount > 0) action = `<button class="button secondary tiny" data-action="manual-match" data-id="${escapeHtml(line.id)}">Match receipt</button>`;
      else if (line.status === 'Unmatched') action = `<button class="button secondary tiny" data-action="classify" data-id="${escapeHtml(line.id)}">Classify</button><button class="button secondary tiny" data-action="ignore" data-id="${escapeHtml(line.id)}">Exclude</button>`;
      else if (match) action = `<small>${escapeHtml(match.paymentReference)} · ${escapeHtml(match.method)}</small>`;
      else action = `<small>${escapeHtml(line.classification || '')}</small>`;
      const amount = `${line.amount < 0 ? '−' : '+'}${money(Math.abs(line.amount), line.currency)}`;
      return `<tr><td><strong>${escapeHtml(line.transactionDate)}</strong><small>${escapeHtml(line.reference || 'No reference')}</small></td><td>${escapeHtml(line.description)}</td><td>${escapeHtml(line.bankAccount)}</td><td><strong>${escapeHtml(amount)}</strong><small>${escapeHtml(line.currency)}</small></td><td>${statusBadge(line.status)}</td><td><div class="actions">${action}</div></td></tr>`;
    }).join('') || `<tr><td colspan="6" class="empty">No statement lines match the filters.</td></tr>`;
  }
  function renderMatching() {
    const lines = state.lines.filter((x) => x.status === 'Unmatched' && x.amount > 0).sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
    $('#suggestions-body').innerHTML = lines.map((line) => {
      const top = E.candidateMatches(state, line)[0];
      const suggestion = top ? `<strong>${escapeHtml(top.payment.reference)}</strong><small>${escapeHtml(top.payment.customerName)} · ${escapeHtml(top.payment.externalReference || 'No external reference')} · ${top.dateDays.toFixed(0)} day(s) apart</small>` : '<small>No equal-amount, equal-currency receipt candidate.</small>';
      return `<tr><td><strong>${escapeHtml(line.reference || line.id)}</strong><small>${escapeHtml(line.transactionDate)} · ${escapeHtml(line.description)}</small></td><td><strong>${escapeHtml(money(line.amount, line.currency))}</strong><small>${escapeHtml(line.currency)}</small></td><td>${suggestion}</td><td>${top ? statusBadge(top.confidence) : '—'}</td><td><button class="button secondary tiny" data-action="manual-match" data-id="${escapeHtml(line.id)}" ${top ? '' : 'disabled'}>Review match</button></td></tr>`;
    }).join('') || `<tr><td colspan="5" class="empty">No unmatched bank credits.</td></tr>`;
    const unmatched = state.billingPayments.filter((p) => !state.matches.some((m) => m.paymentId === p.id));
    $('#unmatched-payments-body').innerHTML = unmatched.map((p) => `<tr><td><strong>${escapeHtml(p.reference)}</strong><small>${escapeHtml(p.externalReference || 'No external reference')}</small></td><td>${escapeHtml(p.customerName || p.customerId)}</td><td>${escapeHtml(String(p.receivedAt).slice(0, 10))}</td><td><strong>${escapeHtml(money(p.amount, p.currency))}</strong></td><td>${statusBadge(p.demo ? 'Demo' : 'Unmatched')}</td></tr>`).join('') || `<tr><td colspan="5" class="empty">Every imported Billing receipt currently has a statement match.</td></tr>`;
  }
  function renderClose() {
    $('#close-list').innerHTML = state.closes.map((close) => {
      const blockers = close.blockers.length ? `<ul class="blockers">${close.blockers.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` : '<p class="help">No blockers were recorded when this close was prepared.</p>';
      let actions = '';
      if (close.status === 'Prepared') actions = `<button class="button secondary tiny" data-action="refresh-close" data-id="${escapeHtml(close.id)}">Refresh checklist</button><button class="button primary tiny" data-action="approve-close" data-id="${escapeHtml(close.id)}" ${close.blockers.length ? 'disabled' : ''}>Approve close</button>`;
      if (close.status === 'Approved') actions = `<button class="button secondary tiny" data-action="reopen-close" data-id="${escapeHtml(close.id)}">Reopen period</button>`;
      return `<article class="close-card"><div class="close-top"><div><h3>${escapeHtml(close.reference)} · ${escapeHtml(close.startDate)} to ${escapeHtml(close.endDate)}</h3><p>${close.lineCount} statement lines · ${close.matchedLines} matched · ${close.classifiedLines + close.ignoredLines} classified/excluded · ${close.paymentCount} billing receipts</p></div>${statusBadge(close.status)}</div>${blockers}<div class="close-meta"><span>Prepared: ${escapeHtml(close.preparedBy)} · ${dateTime(close.preparedAt)}</span>${close.approvedBy ? `<span>Approved: ${escapeHtml(close.approvedBy)} · ${dateTime(close.approvedAt)}</span>` : ''}${close.reopenedBy ? `<span>Reopened: ${escapeHtml(close.reopenedBy)} · ${escapeHtml(close.reopenReason)}</span>` : ''}</div><div class="close-actions">${actions}</div></article>`;
    }).join('') || empty('No period close records have been prepared.');
  }
  function renderActivity() {
    $('#activity-list').innerHTML = state.activity.slice(0, 150).map((item) => `<div class="activity"><time>${dateTime(item.at)}</time>${escapeHtml(item.message)}</div>`).join('') || empty('No finance activity recorded.');
  }
  function renderAccounts() { $('#account-select').innerHTML = state.accounts.filter((a) => a.active).map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)} · ${escapeHtml(a.maskedNumber || '')}</option>`).join(''); }
  function render() { renderMetrics(); renderOverview(); renderAccounts(); renderLines(); renderMatching(); renderClose(); renderActivity(); }
  function setTab(name) {
    $$('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === name));
    $$('.tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `panel-${name}`));
  }
  const specs = {
    'manual-match': { title: 'Review and match receipt', help: 'Amount and currency must match exactly. Non-exact reference matching requires a written explanation.', fields: (context) => {
      const line = E.getLine(state, context.id); const candidates = E.candidateMatches(state, line);
      return [{ name: 'paymentId', label: 'Billing receipt candidate', type: 'select', required: true, options: candidates.map((x) => ({ value: x.payment.id, label: `${x.payment.reference} · ${x.payment.customerName} · ${money(x.payment.amount, x.payment.currency)} · ${x.confidence}` })) }, { name: 'matchedBy', label: 'Matched by', required: true, defaultValue: 'Finance Operations' }, { name: 'reason', label: 'Reason for manual link (minimum 20 characters)', type: 'textarea', min: 20, required: true, wide: true }];
    } },
    classify: { title: 'Classify bank movement', help: 'Use for non-payment bank movements. Do not classify a customer receipt to bypass a missing Billing record.', fields: (context) => { const line = E.getLine(state, context.id); const options = line.amount < 0 ? E.DEBIT_CLASSES : E.CREDIT_CLASSES; return [{ name: 'classification', label: 'Classification', type: 'select', required: true, options: options.map((x) => ({ value: x, label: x })) }, { name: 'classifiedBy', label: 'Classified by', required: true, defaultValue: 'Finance Operations' }, { name: 'reason', label: 'Evidence / explanation (minimum 15 characters)', type: 'textarea', required: true, min: 15, wide: true }]; } },
    ignore: { title: 'Record approved exclusion', help: 'Only use for an evidenced statement line that is legitimately outside this reconciliation. Exclusions remain visible in the audit trail.', fields: () => [{ name: 'ignoredBy', label: 'Reviewed by', required: true, defaultValue: 'Finance Supervisor' }, { name: 'reason', label: 'Exclusion reason and evidence (minimum 20 characters)', type: 'textarea', required: true, min: 20, wide: true }] },
    'auto-match': { title: 'Auto-match exact references', help: 'Only unique reference + amount + currency matches are accepted. Amount-only suggestions remain for manual review.', fields: () => [{ name: 'matchedBy', label: 'Executed by', required: true, defaultValue: 'Finance Operations' }] },
    'prepare-close': { title: 'Prepare finance period close', help: 'Every statement transaction and imported Billing receipt must be accounted for. Approval is a separate action by another person.', fields: () => { const today = new Date(); const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString().slice(0, 10); const end = today.toISOString().slice(0, 10); return [{ name: 'startDate', label: 'Period start', type: 'date', required: true, defaultValue: start }, { name: 'endDate', label: 'Period end', type: 'date', required: true, defaultValue: end }, { name: 'preparedBy', label: 'Prepared by', required: true, defaultValue: 'Finance Operations' }, { name: 'note', label: 'Close note (minimum 12 characters)', type: 'textarea', required: true, min: 12, wide: true }]; } },
    'approve-close': { title: 'Approve finance period close', help: 'Approval is blocked while any reconciliation exception remains. The approver must be different from the preparer.', fields: () => [{ name: 'approvedBy', label: 'Approved by', required: true, defaultValue: 'Finance Controller' }] },
    'reopen-close': { title: 'Reopen approved period', help: 'Reopening must be justified and performed by a person other than the original approver.', fields: () => [{ name: 'reopenedBy', label: 'Reopened by', required: true, defaultValue: 'Finance Controller' }, { name: 'reason', label: 'Reason for reopening (minimum 20 characters)', type: 'textarea', required: true, min: 20, wide: true }] }
  };
  function openAction(kind, id) {
    const spec = specs[kind]; if (!spec) return;
    activeAction = { kind, id };
    $('#action-title').textContent = spec.title; $('#action-help').textContent = spec.help; $('#action-fields').replaceChildren();
    spec.fields({ id }).forEach((field) => {
      const label = document.createElement('label'); if (field.wide) label.className = 'wide'; label.textContent = field.label;
      let input;
      if (field.type === 'textarea') { input = document.createElement('textarea'); input.rows = 3; }
      else if (field.type === 'select') { input = document.createElement('select'); field.options.forEach((x) => { const option = document.createElement('option'); option.value = x.value; option.textContent = x.label; input.appendChild(option); }); }
      else { input = document.createElement('input'); input.type = field.type || 'text'; }
      input.name = field.name; input.required = !!field.required; if (field.min && field.type !== 'date') input.minLength = field.min; if (field.defaultValue) input.value = field.defaultValue;
      label.appendChild(input); $('#action-fields').appendChild(label);
    });
    $('#action-dialog').showModal();
  }
  function runAction(context, data) {
    const now = new Date();
    switch (context.kind) {
      case 'manual-match': E.manualMatch(state, context.id, data.paymentId, data, now); break;
      case 'classify': E.classifyLine(state, context.id, data, now); break;
      case 'ignore': E.ignoreLine(state, context.id, data, now); break;
      case 'auto-match': E.autoMatchExactReferences(state, data, now); break;
      case 'prepare-close': E.preparePeriodClose(state, billingState, data, now); break;
      case 'approve-close': E.approvePeriodClose(state, context.id, data, now); break;
      case 'reopen-close': E.reopenPeriodClose(state, context.id, data, now); break;
      default: throw new Error('Unsupported finance action.');
    }
  }

  $$('.tab').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.tab)));
  $('#sync-billing').addEventListener('click', () => {
    billingState = readBillingState();
    if (!billingState) { toast('Billing v5.8 local records were not found. Open Billing Operations on this origin and try again.', true); return; }
    try { const count = E.syncBillingPayments(state, billingState, new Date()); saveAndRender(); toast(`${count} Billing receipt record(s) imported.`); }
    catch (error) { toast(error.message, true); }
  });
  $('#auto-match').addEventListener('click', () => openAction('auto-match'));
  $('#statement-file').addEventListener('change', (event) => { $('#file-name').textContent = event.target.files[0] ? event.target.files[0].name : 'No file selected'; });
  $('#import-statement').addEventListener('click', async () => {
    const file = $('#statement-file').files[0]; if (!file) { toast('Choose a CSV statement file first.', true); return; }
    try { const csv = await file.text(); const batch = E.importStatementCsv(state, csv, { accountId: $('#account-select').value, importedBy: $('#imported-by').value, sourceName: file.name }, new Date()); saveAndRender(); $('#statement-file').value = ''; $('#file-name').textContent = 'No file selected'; toast(`${batch.importedCount} rows imported; ${batch.duplicateCount} duplicates skipped.`); }
    catch (error) { toast(error.message, true); }
  });
  ['line-search', 'line-status', 'line-direction'].forEach((id) => $(`#${id}`).addEventListener('input', renderLines));
  document.addEventListener('click', (event) => {
    const close = event.target.closest('[data-close]'); if (close) { $(`#${close.dataset.close}`).close(); return; }
    const button = event.target.closest('[data-action]'); if (button) { if (button.dataset.action === 'refresh-close') { try { E.refreshPeriodClose(state, button.dataset.id, new Date()); saveAndRender(); toast('Period-close checklist refreshed.'); } catch (error) { toast(error.message, true); } return; } openAction(button.dataset.action, button.dataset.id); }
  });
  $('#action-form').addEventListener('submit', (event) => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { runAction(activeAction, data); persist(); render(); $('#action-dialog').close(); toast('Finance control record saved.'); }
    catch (error) { toast(error.message, true); }
  });
  $('#prepare-close').addEventListener('click', () => openAction('prepare-close'));
  $('#export-lines').addEventListener('click', () => download('calloria-bank-statement-lines.csv', E.toCsv(state.lines, [{ label: 'Date', value: 'transactionDate' }, { label: 'Value date', value: 'valueDate' }, { label: 'Account', value: 'bankAccount' }, { label: 'Reference', value: 'reference' }, { label: 'Description', value: 'description' }, { label: 'Currency', value: 'currency' }, { label: 'Signed amount', value: 'amount' }, { label: 'Status', value: 'status' }, { label: 'Classification', value: 'classification' }])));
  $('#export-matches').addEventListener('click', () => download('calloria-reconciliation-matches.csv', E.toCsv(state.matches, [{ label: 'Statement reference', value: 'statementReference' }, { label: 'Billing receipt', value: 'paymentReference' }, { label: 'Amount', value: 'amount' }, { label: 'Currency', value: 'currency' }, { label: 'Method', value: 'method' }, { label: 'Matched by', value: 'matchedBy' }, { label: 'Reason', value: 'reason' }, { label: 'Matched at', value: 'matchedAt' }])));
  $('#export-activity').addEventListener('click', () => download('calloria-finance-audit.csv', E.toCsv(state.activity, [{ label: 'Timestamp', value: 'at' }, { label: 'Activity', value: 'message' }])));
  render();
})();
