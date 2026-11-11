(function () {
  'use strict';
  const E = window.CalloriaKnowledgeEngine;
  if (!E) return;
  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = new Date().toISOString().slice(0, 10);
  let state = E.load(window.localStorage, today);
  let view = 'dashboard';
  let selectedArticleId = null;
  let editArticleId = null;
  let noticeTimer = null;

  const titles = {
    dashboard: ['Knowledge operations', 'Controlled service knowledge, product support routes and operational change notices.'],
    library: ['Knowledge library', 'Search approved guidance, inspect article controls and record use against a service interaction.'],
    authoring: ['Article authoring', 'Create controlled guidance and route it through review before agents can use it.'],
    catalog: ['Products & services', 'RuffNeck platforms and game services, with defined first-line support topics.'],
    notices: ['Service notices', 'Publish changes, operational alerts and briefing summaries for customer-care teams.']
  };

  function persist() { E.save(state, window.localStorage); }
  function notify(message, error = false) {
    const box = $('#notice'); box.textContent = message; box.hidden = false; box.classList.toggle('error', error);
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { box.hidden = true; }, 4800);
  }
  function productName(id) { return id === 'general' ? 'General service' : (E.productById(id)?.name || 'General service'); }
  function statusPill(status) {
    const cls = status === 'Published' ? 'status-published' : status === 'In Review' ? 'status-review' : status === 'Changes Requested' ? 'status-changes' : 'status-draft';
    return `<span class="status-pill ${cls}">${escapeHtml(status)}</span>`;
  }
  function renderMetrics() {
    const m = E.getMetrics(state, today);
    const cards = [
      ['PUBLISHED ARTICLES', m.publishedArticles, 'Approved and currently available'],
      ['IN REVIEW', m.inReview, 'Waiting for reviewer decision'],
      ['DRAFTS', m.drafts, 'Not visible in agent search'],
      ['SERVICE NOTICES', m.publishedNotices, `${m.criticalNotices} critical published`],
      ['ARTICLE USES', m.articleUsage, 'Recorded knowledge references']
    ];
    $('#metrics').innerHTML = cards.map(([label, value, foot]) => `<div class="metric-card"><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-foot">${escapeHtml(foot)}</div></div>`).join('');
  }
  function renderDashboard() {
    const notices = state.notices.filter((n) => n.status === 'Published').sort((a,b) => String(b.publishedAt).localeCompare(String(a.publishedAt))).slice(0,5);
    const popular = state.articles.filter((a) => a.status === 'Published').sort((a,b) => (b.usageCount || 0) - (a.usageCount || 0) || (b.views || 0) - (a.views || 0)).slice(0,6);
    const reviewQueue = state.articles.filter((a) => a.status === 'In Review');
    const expired = state.articles.filter((a) => a.status === 'Published' && a.expiresAt && a.expiresAt < today);
    return `<div class="workspace-grid">
      <div class="panel"><div class="panel-head"><div><h2>Knowledge most used by agents</h2><div class="panel-subtitle">Usage is recorded manually from the article reader.</div></div><button class="button button-outline button-small" data-goto="library" type="button">Open library</button></div>
        <div class="article-list">${popular.map((a) => `<div class="article-row"><div><div class="article-title">${escapeHtml(a.title)}</div><div class="article-meta"><span>${escapeHtml(productName(a.productId))}</span><span>·</span><span>${escapeHtml(a.category)}</span><span>·</span><span>${a.usageCount || 0} uses</span></div></div><button class="button button-outline button-small" type="button" data-open="${escapeHtml(a.id)}">View</button></div>`).join('') || '<div class="empty-state">No usage records yet. Open an article and record its use against a sample interaction.</div>'}</div>
      </div>
      <div class="panel"><div class="panel-head"><div><h2>Review queue</h2><div class="panel-subtitle">Articles must be reviewed before publication.</div></div><span class="tag">${reviewQueue.length} waiting</span></div>
        ${reviewQueue.length ? `<div class="article-list">${reviewQueue.slice(0,5).map((a) => `<div class="article-row"><div><div class="article-title">${escapeHtml(a.title)}</div><div class="article-meta">${escapeHtml(a.owner)} · Version ${a.version}</div></div><button class="button button-outline button-small" data-open="${escapeHtml(a.id)}" type="button">Review</button></div>`).join('')}</div>` : '<div class="empty-state">No articles are waiting for review.</div>'}
      </div>
      <div class="panel"><div class="panel-head"><div><h2>Current service notices</h2><div class="panel-subtitle">Published service changes and operational updates.</div></div><button class="button button-outline button-small" type="button" data-goto="notices">Manage notices</button></div>
        <div class="notice-list">${notices.map(renderNoticeRow).join('') || '<div class="empty-state">No service notices published.</div>'}</div>
      </div>
      <div class="panel"><div class="panel-head"><div><h2>Control reminders</h2><div class="panel-subtitle">Items needing maintenance or human confirmation.</div></div></div>
        <div class="activity-list"><div class="activity-item"><strong>${expired.length}</strong> published article(s) have passed their expiry date. They are excluded from current article search.</div><div class="activity-item"><strong>${E.getMetrics(state, today).changesRequested}</strong> article(s) have been returned to authors for changes.</div><div class="activity-item"><strong>${state.integration.importedBriefings || 0}</strong> briefing record(s) imported from Learning Academy v5.1.</div><div class="activity-item">Live product status, player statistics, ad inventory and commercial rates are not retrieved by this module. Verify them through an approved current source before quoting customers.</div></div>
      </div>
    </div>
    <div class="panel" style="margin-top:17px"><div class="panel-head"><div><h2>Recent knowledge activity</h2><div class="panel-subtitle">Local audit-style activity log; not a tamper-proof server audit trail.</div></div></div><div class="activity-list">${state.activity.slice(0,8).map((item) => `<div class="activity-item"><time>${escapeHtml(item.date)}</time>${escapeHtml(item.text)}</div>`).join('') || '<div class="empty-state">No activity recorded yet.</div>'}</div></div>`;
  }
  function renderNoticeRow(notice) {
    return `<div class="notice-row severity-${escapeHtml(notice.severity)}"><div class="notice-meta"><span class="tag ${notice.severity === 'Critical' ? 'critical' : notice.severity === 'Important' ? 'important' : 'info'}">${escapeHtml(notice.severity)}</span><span>${escapeHtml(productName(notice.productId))}</span><span>·</span><span>Effective ${escapeHtml(notice.effectiveAt)}</span></div><div class="notice-title">${escapeHtml(notice.title)}</div><div class="notice-text">${escapeHtml(notice.summary)}</div></div>`;
  }
  function renderArticleRow(article) {
    return `<div class="article-row"><div><div class="article-title">${escapeHtml(article.title)}</div><div class="article-meta"><span>${escapeHtml(productName(article.productId))}</span><span>·</span><span>${escapeHtml(article.category)}</span><span>·</span><span>v${article.version}</span><span>·</span><span>${article.usageCount || 0} uses</span></div><div class="article-summary">${escapeHtml(article.summary)}</div></div><div class="row-actions">${statusPill(article.status)}<button class="button button-outline button-small" type="button" data-open="${escapeHtml(article.id)}">Open</button></div></div>`;
  }
  function renderReader(article) {
    if (!article) return '';
    const published = E.articleIsAvailable(article, today);
    return `<div class="reader" id="article-reader"><div class="article-meta"><span>${escapeHtml(productName(article.productId))}</span><span>·</span><span>${escapeHtml(article.category)}</span><span>·</span><span>Version ${article.version}</span><span>·</span>${statusPill(article.status)}</div><h3>${escapeHtml(article.title)}</h3><p class="reader-summary">${escapeHtml(article.summary)}</p><ol class="steps-list">${(article.steps || []).map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol><div class="article-meta"><span>Owner: ${escapeHtml(article.owner || '—')}</span><span>Reviewer: ${escapeHtml(article.reviewer || '—')}</span><span>Updated: ${escapeHtml(article.updatedAt || '—')}</span>${article.expiresAt ? `<span>Expires: ${escapeHtml(article.expiresAt)}</span>` : ''}</div>
      ${article.reviewNote ? `<div class="review-box"><label>Reviewer note</label><div class="small-note">${escapeHtml(article.reviewNote)}</div></div>` : ''}
      <div class="reader-actions">${published ? `<button class="button button-primary button-small" type="button" data-usage-open="${escapeHtml(article.id)}">Record article use</button>` : ''}<button class="button button-outline button-small" type="button" data-edit="${escapeHtml(article.id)}">Edit article</button>${article.status === 'Draft' || article.status === 'Changes Requested' ? `<button class="button button-outline button-small" type="button" data-submit-review="${escapeHtml(article.id)}">Submit for review</button>` : ''}${article.status === 'In Review' ? `<button class="button button-primary button-small" type="button" data-publish-article="${escapeHtml(article.id)}">Approve & publish</button><button class="button button-danger button-small" type="button" data-return-article="${escapeHtml(article.id)}">Request changes</button>` : ''}</div>
      ${published ? `<form class="usage-form" data-usage-form="${escapeHtml(article.id)}"><strong class="small-note">Interaction reference</strong><select name="channel" aria-label="Interaction channel"><option>Voice</option><option>Email</option><option>Live chat</option><option>Social</option><option>SMS</option></select><input name="caseRef" maxlength="40" placeholder="Case reference (optional)"><input name="employee" maxlength="80" placeholder="Employee / agent"><select name="outcome" aria-label="Article outcome"><option>Viewed</option><option>Resolved</option><option>Partially resolved</option><option>Escalated</option></select><button class="button button-outline button-small" type="submit">Save usage</button></form>` : ''}</div>`;
  }
  function renderLibrary() {
    const all = E.searchArticles(state, $('#article-search')?.value || '', { status: $('#article-status')?.value || '', productId: $('#article-product')?.value || '', category: $('#article-category')?.value || '' }, today);
    const shown = selectedArticleId ? E.getArticle(state, selectedArticleId) : null;
    return `<div class="panel"><div class="panel-head"><div><h2>Search controlled guidance</h2><div class="panel-subtitle">Only published, non-expired guidance should be used for live service handling.</div></div><span class="tag">${all.length} results</span></div>
      <div class="toolbar"><input id="article-search" value="${escapeHtml($('#article-search')?.value || '')}" type="search" placeholder="Search title, keywords or steps..."><select id="article-status"><option value="">All statuses</option>${['Published','Draft','In Review','Changes Requested'].map((s) => `<option ${($('#article-status')?.value === s) ? 'selected' : ''}>${s}</option>`).join('')}</select><select id="article-product"><option value="">All products</option><option value="general" ${$('#article-product')?.value === 'general' ? 'selected' : ''}>General service</option>${state.products.map((p) => `<option value="${p.id}" ${$('#article-product')?.value === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}</select><select id="article-category"><option value="">All categories</option>${E.CATEGORIES.map((c) => `<option ${$('#article-category')?.value === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}</select></div>
      <div class="article-list">${all.map(renderArticleRow).join('') || '<div class="empty-state">No matching articles. Clear a filter or create a new draft.</div>'}</div>
      ${renderReader(shown)}</div>`;
  }
  function productOptions(selected) {
    return `<option value="general" ${selected === 'general' || !selected ? 'selected' : ''}>General service</option>${state.products.map((p) => `<option value="${p.id}" ${selected === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}`;
  }
  function renderAuthoring() {
    const article = editArticleId ? E.getArticle(state, editArticleId) : null;
    const values = article || {};
    return `<div class="panel"><div class="panel-head"><div><h2>${article ? `Revise article · v${article.version}` : 'Create a knowledge article'}</h2><div class="panel-subtitle">New or revised guidance starts as a draft and must pass review before publication.</div></div>${article ? '<button class="button button-outline button-small" type="button" data-cancel-edit>Cancel edit</button>' : ''}</div>
      <form id="article-form"><div class="form-grid"><div class="field"><label for="article-title-input">Article title</label><input id="article-title-input" name="title" required minlength="5" maxlength="140" value="${escapeHtml(values.title || '')}" placeholder="e.g. Resolve an account access request"></div>
      <div class="field"><label for="article-product-input">Product / service</label><select id="article-product-input" name="productId">${productOptions(values.productId)}</select></div>
      <div class="field"><label for="article-category-input">Knowledge category</label><select id="article-category-input" name="category" required>${E.CATEGORIES.map((c) => `<option ${values.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}</select></div>
      <div class="field"><label for="article-industry-input">Industry / service context</label><select id="article-industry-input" name="industry">${state.industries.map((c) => `<option ${values.industry === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}</select></div>
      <div class="field full"><label for="article-summary-input">Purpose and scope</label><textarea id="article-summary-input" name="summary" required minlength="20" maxlength="500" placeholder="State when this guidance applies and what it helps the agent do.">${escapeHtml(values.summary || '')}</textarea></div>
      <div class="field full"><label for="article-steps-input">Procedure / decision steps</label><textarea id="article-steps-input" name="steps" required placeholder="One action per line. Include escalation boundaries and what to record.">${escapeHtml((values.steps || []).join('\n'))}</textarea><div class="field-help">Use observable steps. Do not include passwords, private customer data or unverified product promises.</div></div>
      <div class="field"><label for="article-keywords-input">Search keywords</label><input id="article-keywords-input" name="keywords" maxlength="240" value="${escapeHtml(values.keywords || '')}" placeholder="access, login, error, account"></div>
      <div class="field"><label for="article-expiry-input">Review / expiry date (optional)</label><input id="article-expiry-input" name="expiresAt" type="date" min="${today}" value="${escapeHtml(values.expiresAt || '')}"></div>
      <div class="field"><label for="article-owner-input">Article owner</label><input id="article-owner-input" name="owner" maxlength="100" value="${escapeHtml(values.owner || 'Knowledge Operations')}"></div>
      <div class="field"><label for="article-reviewer-input">Assigned reviewer</label><input id="article-reviewer-input" name="reviewer" maxlength="100" value="${escapeHtml(values.reviewer || 'Service Quality Lead')}"></div></div>
      <div class="form-actions"><button class="button button-primary" type="submit">${article ? 'Save new revision' : 'Save draft article'}</button></div></form>
      <div class="catalog-note" style="margin-top:18px">Article lifecycle: Draft → In Review → Published, or Changes Requested → Draft. Editing a published article creates a new draft revision and retains a short local history of prior versions.</div></div>`;
  }
  function renderCatalog() {
    return `<div class="catalog-note">RuffNeck product names and public sites below are seeded from the project requirements. This workspace does not query those products, verify current features, check availability or retrieve live usage statistics. Use the product's current approved documentation when resolving a live customer issue.</div><div class="product-grid">${state.products.map((p) => `<article class="product-card"><div class="product-top"><span class="product-kind">${escapeHtml(p.group)} · ${escapeHtml(p.kind)}</span><span class="tag">Active reference</span></div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description)}</p><div class="topic-chips">${p.topics.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div><div class="small-note">Related services: ${p.related.map((id) => escapeHtml(E.productById(id)?.name || id)).join(' · ')}</div><div class="product-bottom"><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">Open product site ↗</a><button class="button button-outline button-small" data-filter-product="${escapeHtml(p.id)}" type="button">View articles</button></div></article>`).join('')}</div>
      <div class="split-panels" style="margin-top:16px"><div class="panel"><div class="panel-head"><h2>Industry coverage</h2></div><div class="topic-chips">${state.industries.map((i) => `<span class="tag">${escapeHtml(i)}</span>`).join('')}</div><p class="small-note" style="margin-top:13px">General Customer Experience is the default operating model. Banking is an optional industry pack, not the entire game.</p></div><div class="panel"><div class="panel-head"><h2>Service discovery rules</h2></div><div class="small-note">Resolve or progress the customer's primary request first. Recommend another RuffNeck service only when relevant and with permission. Do not promise unverified features, integrations, advertising inventory, rates, player counts or outcomes.</div></div></div>`;
  }
  function renderNotices() {
    const notices = state.notices.slice().sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return `<div class="workspace-grid"><div class="panel"><div class="panel-head"><div><h2>Service change notice</h2><div class="panel-subtitle">Create a controlled notice for impacted service teams.</div></div></div><form id="notice-form"><div class="form-grid"><div class="field full"><label for="notice-title-input">Notice title</label><input id="notice-title-input" name="title" required minlength="5" maxlength="140" placeholder="e.g. Updated customer verification route"></div><div class="field"><label for="notice-product-input">Affected product / service</label><select id="notice-product-input" name="productId">${productOptions('general')}</select></div><div class="field"><label for="notice-severity-input">Severity</label><select id="notice-severity-input" name="severity"><option>Information</option><option>Important</option><option>Critical</option></select></div><div class="field"><label for="notice-audience-input">Audience</label><input id="notice-audience-input" name="audience" maxlength="100" value="All customer-care teams"></div><div class="field"><label for="notice-effective-input">Effective date</label><input id="notice-effective-input" name="effectiveAt" type="date" min="${today}" value="${today}" required></div><div class="field full"><label for="notice-summary-input">What changed and what agents must do</label><textarea id="notice-summary-input" name="summary" minlength="20" maxlength="700" required placeholder="Describe the change, effective date, affected users and required action."></textarea></div></div><div class="form-actions"><button class="button button-primary" type="submit">Save notice draft</button></div></form><div class="catalog-note" style="margin-top:14px">Review product-specific instructions before publishing a notice. Publishing here does not send a push notification, email or calendar invitation.</div></div>
      <div class="panel"><div class="panel-head"><div><h2>Notice register</h2><div class="panel-subtitle">Drafts can be published from this register.</div></div><span class="tag">${notices.length} notices</span></div><div class="notice-list">${notices.map((n) => `<div class="notice-row severity-${escapeHtml(n.severity)}"><div class="notice-meta"><span class="tag ${n.severity === 'Critical' ? 'critical' : n.severity === 'Important' ? 'important' : 'info'}">${escapeHtml(n.severity)}</span><span>${escapeHtml(productName(n.productId))}</span><span>·</span><span>${escapeHtml(n.status)}</span><span>·</span><span>Effective ${escapeHtml(n.effectiveAt)}</span></div><div class="notice-title">${escapeHtml(n.title)}</div><div class="notice-text">${escapeHtml(n.summary)}</div>${n.status === 'Draft' ? `<div class="reader-actions"><button class="button button-primary button-small" type="button" data-publish-notice="${escapeHtml(n.id)}">Publish notice</button></div>` : `<div class="notice-meta">Published ${escapeHtml(n.publishedAt || '')}${n.sourceBriefingId ? ' · Imported from Learning Academy v5.1' : ''}</div>`}</div>`).join('') || '<div class="empty-state">No notices created yet.</div>'}</div></div></div>`;
  }
  function render() {
    $('#page-title').textContent = titles[view][0]; $('#page-subtitle').textContent = titles[view][1];
    document.querySelectorAll('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.view === view));
    renderMetrics();
    let html = '';
    if (view === 'dashboard') html = renderDashboard();
    if (view === 'library') html = renderLibrary();
    if (view === 'authoring') html = renderAuthoring();
    if (view === 'catalog') html = renderCatalog();
    if (view === 'notices') html = renderNotices();
    $('#workspace').innerHTML = html;
  }
  function changeView(next) { view = next; if (view !== 'authoring') editArticleId = null; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function download(filename, contents, type = 'text/csv;charset=utf-8') {
    const blob = new Blob([contents], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }
  function formData(form) { return Object.fromEntries(new FormData(form).entries()); }

  document.querySelectorAll('.nav-item').forEach((el) => el.addEventListener('click', () => changeView(el.dataset.view)));
  $('#workspace').addEventListener('click', (event) => {
    const target = event.target.closest('button'); if (!target) return;
    try {
      if (target.dataset.goto) { changeView(target.dataset.goto); return; }
      if (target.dataset.open) { selectedArticleId = target.dataset.open; render(); return; }
      if (target.dataset.edit) { editArticleId = target.dataset.edit; changeView('authoring'); return; }
      if (target.hasAttribute('data-cancel-edit')) { editArticleId = null; render(); return; }
      if (target.dataset.submitReview) { E.submitForReview(state, target.dataset.submitReview, today); persist(); notify('Article submitted to the review queue.'); render(); return; }
      if (target.dataset.publishArticle) { E.publishArticle(state, target.dataset.publishArticle, 'Service Quality Lead', today); persist(); notify('Article approved and published.'); render(); return; }
      if (target.dataset.returnArticle) { const note = window.prompt('State the required changes for the author:'); if (note != null) { E.requestChanges(state, target.dataset.returnArticle, note, 'Service Quality Lead', today); persist(); notify('Article returned to its author with review feedback.'); render(); } return; }
      if (target.dataset.usageOpen) { $('#article-reader')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('[data-usage-form] input[name="employee"]')?.focus(); return; }
      if (target.dataset.filterProduct) { selectedArticleId = null; changeView('library'); const sel = $('#article-product'); if (sel) { sel.value = target.dataset.filterProduct; $('#workspace').innerHTML = renderLibrary(); } return; }
      if (target.dataset.publishNotice) { E.publishNotice(state, target.dataset.publishNotice, today); persist(); notify('Service notice published.'); render(); return; }
    } catch (error) { notify(error.message || 'The action could not be completed.', true); }
  });
  $('#workspace').addEventListener('input', (event) => {
    if (['article-search'].includes(event.target.id)) {
      const pos = event.target.selectionStart; const value = event.target.value; const panel = $('#workspace .panel');
      // Replace only the result list while retaining the search controls and current reader selection.
      const oldList = panel?.querySelector('.article-list');
      if (oldList) oldList.innerHTML = E.searchArticles(state, value, { status: $('#article-status')?.value || '', productId: $('#article-product')?.value || '', category: $('#article-category')?.value || '' }, today).map(renderArticleRow).join('') || '<div class="empty-state">No matching articles.</div>';
      const count = panel?.querySelector('.panel-head .tag'); if (count) count.textContent = `${E.searchArticles(state, value, { status: $('#article-status')?.value || '', productId: $('#article-product')?.value || '', category: $('#article-category')?.value || '' }, today).length} results`;
      event.target.setSelectionRange(pos, pos);
    }
  });
  $('#workspace').addEventListener('change', (event) => {
    if (['article-status','article-product','article-category'].includes(event.target.id)) {
      const search = $('#article-search')?.value || ''; const panel = $('#workspace .panel'); const matches = E.searchArticles(state, search, { status: $('#article-status')?.value || '', productId: $('#article-product')?.value || '', category: $('#article-category')?.value || '' }, today);
      const list = panel?.querySelector('.article-list'); if (list) list.innerHTML = matches.map(renderArticleRow).join('') || '<div class="empty-state">No matching articles.</div>';
      const count = panel?.querySelector('.panel-head .tag'); if (count) count.textContent = `${matches.length} results`;
    }
  });
  $('#workspace').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      if (event.target.id === 'article-form') {
        const data = formData(event.target); data.steps = data.steps.split(/\n+/).map((x) => x.trim()).filter(Boolean);
        const wasEditing = Boolean(editArticleId);
        const article = wasEditing ? E.updateArticle(state, editArticleId, data, today) : E.createArticle(state, data, today);
        selectedArticleId = article.id; editArticleId = null; persist(); notify(wasEditing ? 'Article revision saved as a new draft.' : 'Draft article saved.'); view = 'library'; render(); return;
      }
      if (event.target.id === 'notice-form') {
        const notice = E.createNotice(state, formData(event.target), today); persist(); notify('Service notice saved as a draft.'); render(); return;
      }
      const usageId = event.target.dataset.usageForm;
      if (usageId) {
        E.recordUsage(state, usageId, formData(event.target), today); persist(); notify('Article usage record saved.'); render(); return;
      }
    } catch (error) { notify(error.message || 'The form could not be saved.', true); }
  });
  $('#import-briefings').addEventListener('click', () => {
    try {
      const raw = window.localStorage.getItem(E.ACADEMY_KEY); const academy = raw ? JSON.parse(raw) : null;
      const result = E.importBriefings(state, academy, today); persist(); notify(`${result.imported} new briefing(s) imported; ${result.skipped} existing or cancelled record(s) skipped.`); render();
    } catch (error) { notify(error.message || 'Briefing import failed.', true); }
  });
  $('#export-articles').addEventListener('click', () => download(`calloria-knowledge-articles-${today}.csv`, E.exportCSV(state)));
  render();
})();
