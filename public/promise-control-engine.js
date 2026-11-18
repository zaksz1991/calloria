(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CalloriaPromiseControlEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '6.70.0';
  const DEFAULT_RISK_WINDOW_MINUTES = 30;
  const RISK_RANK = Object.freeze({ critical: 0, urgent: 1, at_risk: 2, watch: 3, normal: 4 });

  function clean(value, max = 300) {
    return String(value == null ? '' : value)
      .replace(/[<>]/g, '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  }

  function getCommitmentEngine() {
    const engine = typeof globalThis !== 'undefined' ? globalThis.CalloriaCommitmentEngine : null;
    if (!engine || typeof engine.classify !== 'function') throw new Error('The callback commitment engine is required.');
    return engine;
  }

  function classifyRisk(item, timing, linkedCallback, riskWindowMinutes = DEFAULT_RISK_WINDOW_MINUTES) {
    const status = timing && timing.state ? timing.state : 'Scheduled';
    const rawDelta = timing && timing.deltaMinutes;
    const delta = rawDelta !== null && rawDelta !== undefined && Number.isFinite(Number(rawDelta)) ? Number(rawDelta) : null;
    let risk = 'normal';
    if (status === 'Needs review' || status === 'Overdue') risk = 'critical';
    else if (status === 'Due') risk = 'urgent';
    else if (status === 'Due soon' || (delta !== null && delta <= riskWindowMinutes)) risk = 'at_risk';
    else if (delta !== null && delta <= riskWindowMinutes * 2) risk = 'watch';
    const callbackActive = Boolean(linkedCallback && ['scheduled', 'queued', 'in_progress'].includes(linkedCallback.status));
    return {
      risk,
      timingState: status,
      deltaMinutes: delta,
      linkedCallback: callbackActive,
      callbackStatus: callbackActive ? linkedCallback.status : 'missing',
      missingCallbackTask: ['Due', 'Overdue', 'Needs review'].includes(status) && !callbackActive,
      escalationOpen: false
    };
  }

  function buildPortfolio(commitmentState, shift, callbacks = [], supervisorRequests = [], options = {}) {
    const engine = getCommitmentEngine();
    const riskWindow = Math.max(1, Math.min(240, Math.floor(Number(options.riskWindowMinutes) || DEFAULT_RISK_WINDOW_MINUTES)));
    const commitments = Array.isArray(commitmentState && commitmentState.commitments) ? commitmentState.commitments : [];
    const callbackRows = Array.isArray(callbacks) ? callbacks : [];
    const requests = Array.isArray(supervisorRequests) ? supervisorRequests : [];
    const rows = commitments
      .filter(item => item && item.id && item.status !== 'Complete')
      .map(item => {
        const timing = engine.classify(item, shift);
        const linked = callbackRows.find(row => row && row.commitmentId === item.id && ['scheduled', 'queued', 'in_progress'].includes(row.status)) || null;
        const risk = classifyRisk(item, timing, linked, riskWindow);
        const openEscalation = requests.find(row => row && row.commitmentId === item.id && row.status === 'open') || null;
        return {
          ...item,
          timing,
          control: {
            ...risk,
            escalationOpen: Boolean(openEscalation),
            escalationId: openEscalation && openEscalation.id || null,
            escalationRequest: openEscalation,
            riskWindowMinutes: riskWindow
          }
        };
      });

    rows.sort((a, b) => {
      const riskDifference = RISK_RANK[a.control.risk] - RISK_RANK[b.control.risk];
      if (riskDifference) return riskDifference;
      const aDelta = a.control.deltaMinutes === null ? Number.MAX_SAFE_INTEGER : a.control.deltaMinutes;
      const bDelta = b.control.deltaMinutes === null ? Number.MAX_SAFE_INTEGER : b.control.deltaMinutes;
      return aDelta - bDelta || String(a.owner).localeCompare(String(b.owner)) || String(a.customerName).localeCompare(String(b.customerName));
    });

    const ownerMap = new Map();
    for (const row of rows) {
      const owner = clean(row.owner || 'Unassigned', 100) || 'Unassigned';
      const current = ownerMap.get(owner) || { owner, total: 0, critical: 0, urgent: 0, atRisk: 0, needsCallbackTask: 0 };
      current.total += 1;
      if (row.control.risk === 'critical') current.critical += 1;
      if (row.control.risk === 'urgent') current.urgent += 1;
      if (row.control.risk === 'at_risk') current.atRisk += 1;
      if (row.control.missingCallbackTask) current.needsCallbackTask += 1;
      ownerMap.set(owner, current);
    }
    const metrics = {
      open: rows.length,
      critical: rows.filter(row => row.control.risk === 'critical').length,
      dueNow: rows.filter(row => row.control.risk === 'urgent').length,
      atRisk: rows.filter(row => row.control.risk === 'at_risk').length,
      watch: rows.filter(row => row.control.risk === 'watch').length,
      missingCallbackTask: rows.filter(row => row.control.missingCallbackTask).length,
      escalated: rows.filter(row => row.control.escalationOpen).length,
      supervisorReview: rows.filter(row => row.status === 'Needs review').length
    };
    return { version: VERSION, rows, metrics, owners: [...ownerMap.values()].sort((a, b) => b.critical - a.critical || b.urgent - a.urgent || b.atRisk - a.atRisk || a.owner.localeCompare(b.owner)), generatedAt: new Date().toISOString() };
  }

  function raiseEscalation(input, context = {}) {
    const engine = getCommitmentEngine();
    const commitmentState = context.commitmentState;
    const item = engine.getCommitment(commitmentState, input && input.commitmentId);
    if (!item) throw new Error('Customer promise was not found.');
    if (item.status === 'Complete') throw new Error('A completed customer promise cannot be escalated.');
    const requests = Array.isArray(context.supervisorRequests) ? context.supervisorRequests : null;
    if (!requests) throw new Error('Supervisor request storage is unavailable.');
    if (requests.some(row => row && row.commitmentId === item.id && row.status === 'open')) throw new Error('An open supervisor escalation already exists for this promise.');
    const timing = engine.classify(item, context.shift);
    const riskWindow = Math.max(1, Math.min(240, Math.floor(Number(context.riskWindowMinutes) || DEFAULT_RISK_WINDOW_MINUTES)));
    const dueDelta = timing.deltaMinutes;
    const dueWithinWindow = dueDelta !== null && dueDelta !== undefined && Number.isFinite(Number(dueDelta)) && Number(dueDelta) <= riskWindow;
    if (!['Due', 'Due soon', 'Overdue', 'Needs review'].includes(timing.state) && !dueWithinWindow) throw new Error('This promise is not yet within the escalation window.');
    const reason = clean(input && input.reason, 500);
    if (reason.length < 20) throw new Error('Explain the customer-service risk in at least 20 characters.');
    const now = context.now instanceof Date ? context.now : new Date(context.now || Date.now());
    if (Number.isNaN(now.getTime())) throw new Error('A valid escalation timestamp is required.');
    const request = {
      id: `PROM-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      commitmentId: item.id,
      contactId: item.contactReference,
      reference: item.caseId || item.contactReference,
      customer: item.customerName,
      owner: item.owner,
      reason,
      status: 'open',
      createdAt: now.toISOString(),
      channel: 'Customer promise control',
      createdBy: clean(context.actor || 'Floor Supervisor', 100),
      promiseRisk: timing.state,
      dueDate: item.dueDate,
      dueMinutes: item.dueMinutes
    };
    requests.unshift(request);
    if (typeof engine.log === 'function') engine.log(commitmentState, `Supervisor escalation raised for customer promise ${item.id} (${timing.state}).`, now);
    return request;
  }

  function resolveEscalation(requests, requestId, input, context = {}) {
    const engine = getCommitmentEngine();
    const rows = Array.isArray(requests) ? requests : [];
    const request = rows.find(row => row && row.id === requestId && row.status === 'open' && row.commitmentId);
    if (!request) throw new Error('Open customer-promise escalation was not found.');
    const commitment = engine.getCommitment(context.commitmentState, request.commitmentId);
    const reviewer = clean(input && input.reviewer, 100);
    if (reviewer.length < 2) throw new Error('Enter the reviewing supervisor name.');
    const owner = clean(commitment && commitment.owner || request.owner, 100);
    if (owner && reviewer.toLowerCase() === owner.toLowerCase()) throw new Error('The reviewer must be different from the original promise owner.');
    const actionTaken = clean(input && input.actionTaken, 500);
    if (actionTaken.length < 20) throw new Error('Document the recovery action in at least 20 characters.');
    const now = context.now instanceof Date ? context.now : new Date(context.now || Date.now());
    if (Number.isNaN(now.getTime())) throw new Error('A valid review timestamp is required.');
    request.status = 'resolved';
    request.resolvedAt = now.toISOString();
    request.resolvedBy = reviewer;
    request.resolutionNotes = actionTaken;
    request.resolutionType = 'promise-recovery-reviewed';
    if (context.commitmentState && typeof engine.log === 'function') engine.log(context.commitmentState, `Promise escalation ${request.id} reviewed by ${reviewer}. The callback commitment remains open until the customer outcome is recorded.`, now);
    return request;
  }

  return {
    VERSION,
    DEFAULT_RISK_WINDOW_MINUTES,
    clean,
    classifyRisk,
    buildPortfolio,
    raiseEscalation,
    resolveEscalation
  };
});
