(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CalloriaKnowledgeEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '5.2.0';
  const STORAGE_KEY = 'calloria.knowledge-operations.v52';
  const ACADEMY_KEY = 'calloria.learning-academy.v51';
  const CATEGORIES = [
    'Account & access', 'Product guidance', 'Billing & payments', 'Technical support',
    'Complaints & service recovery', 'CRM & case handling', 'Voice operations',
    'Digital channels', 'Data care & security', 'Life & personal development',
    'Sales & service discovery', 'Workplace operations'
  ];

  const PRODUCTS = [
    { id: 'ruffneck-lms', name: 'RuffNeck LMS', group: 'RuffNeck Platforms', kind: 'Learning platform', description: 'Learning and course-delivery platform support.', url: 'https://ruffneck-lms.vercel.app/', topics: ['Account access', 'Course enrolment', 'Learning progress', 'Certificates'], related: ['ruffneck-connect', 'ruffneck-social-hub'] },
    { id: 'ruffneck-prospector', name: 'RuffNeck Prospector', group: 'RuffNeck Platforms', kind: 'Prospecting platform', description: 'Prospecting platform support and usage guidance.', url: 'https://ruffneck-prospector.vercel.app/', topics: ['Account access', 'Workspace use', 'Records and results', 'Technical issue'], related: ['ruffneck-connect', 'ruffneck-social-hub'] },
    { id: 'ruffneck-connect', name: 'RuffNeck Connect', group: 'RuffNeck Platforms', kind: 'Connection platform', description: 'RuffNeck Connect account and service-support enquiries.', url: 'https://ruffneck-connect.vercel.app/', topics: ['Account access', 'Setup and onboarding', 'Connection issue', 'Technical issue'], related: ['ruffneck-lms', 'ruffneck-social-hub'] },
    { id: 'ruffneck-social-hub', name: 'RuffNeck Social Hub', group: 'RuffNeck Platforms', kind: 'Social operations platform', description: 'Social Hub access, publishing workflow and platform-support enquiries.', url: 'https://ruffneck-social-hub.vercel.app/', topics: ['Account access', 'Workspace setup', 'Publishing workflow', 'Campaign support'], related: ['ruffneck-prospector', 'ruffneck-connect'] },
    { id: 'kano-run', name: 'Kano Run', group: 'RuffNeck Games', kind: 'Game', description: 'Player support, gameplay enquiries and game-service feedback.', url: 'https://kano-run.vercel.app/', topics: ['Player access', 'Gameplay issue', 'Feedback', 'Sponsorship and advertising'], related: ['kano-keke'] },
    { id: 'kano-keke', name: 'Kano Keke', group: 'RuffNeck Games', kind: 'Game', description: 'Player support, gameplay enquiries and game-service feedback.', url: 'https://kano-keke.vercel.app/', topics: ['Player access', 'Gameplay issue', 'Feedback', 'Sponsorship and advertising'], related: ['kano-run'] }
  ];

  const INDUSTRIES = [
    'General Customer Experience', 'Telecommunications', 'Retail & e-commerce', 'Utilities',
    'Travel & hospitality', 'Logistics & delivery', 'Insurance', 'Healthcare administration',
    'Technology & software', 'Public services', 'Banking (optional industry pack)',
    'Life & Personal Development'
  ];

  const SEED_ARTICLES = [
    ['kb-general-greeting', 'Opening and identifying the customer need', 'general', 'Product guidance', 'General Customer Experience', 'Start every contact with a clear, respectful greeting, establish the reason for contact and confirm the outcome the customer needs.', ['Use the approved greeting for the channel.', 'Allow the customer to explain without unnecessary interruption.', 'Ask focused questions to clarify the request.', 'Summarise the need and agree the next action.'], 'greeting,opening,discovery,customer experience', 'Published'],
    ['kb-general-verification', 'Customer verification and safe information handling', 'general', 'Data care & security', 'General Customer Experience', 'Use the verification steps approved for the relevant service before discussing protected account information. Never ask a customer to disclose passwords or one-time security codes.', ['Select the correct service verification procedure.', 'Collect only the minimum information required.', 'Never request a password, PIN or one-time code.', 'Stop and escalate suspected account compromise.', 'Record the verification outcome without storing secrets.'], 'verification,privacy,security,account', 'Published'],
    ['kb-crm-records', 'Minimum standard for a complete CRM interaction record', 'general', 'CRM & case handling', 'General Customer Experience', 'A useful contact record makes the customer journey understandable to the next authorised employee.', ['Choose the correct customer and service record.', 'Record the reason for contact in plain language.', 'Capture checks performed and relevant facts only.', 'Record the action, owner and agreed next step.', 'Set the correct status and follow-up date.', 'Do not put passwords, payment credentials or unnecessary sensitive details in notes.'], 'crm,case,logging,wrap up', 'Published'],
    ['kb-voice-wrap', 'Voice contact hold, transfer and wrap-up standards', 'general', 'Voice operations', 'General Customer Experience', 'Keep the customer informed during holds and transfers. Confirm the receiving team can accept the transfer before disconnecting.', ['Explain why a hold or transfer is needed.', 'Ask permission before an extended hold where required by policy.', 'Return with a progress update.', 'Use a warm transfer for complex or vulnerable cases.', 'Complete the CRM disposition and follow-up.'], 'voice,hold,transfer,wrap up', 'Published'],
    ['kb-digital-tone', 'Writing clearly in email, chat and social channels', 'general', 'Digital channels', 'General Customer Experience', 'Digital messages should be clear, respectful and specific. Avoid disclosing private account information in public replies.', ['Acknowledge the exact issue.', 'Use short paragraphs and direct instructions.', 'Move account-specific discussion to an approved private channel.', 'State expected timing without inventing a commitment.', 'Proofread links, names and case references before sending.'], 'email,chat,social,writing,tone', 'Published'],
    ['kb-complaint-recovery', 'Complaint ownership and service recovery', 'general', 'Complaints & service recovery', 'General Customer Experience', 'Own the next step even when another team must resolve the underlying issue. Explain what is known, what remains under investigation and when the customer will hear back.', ['Acknowledge the impact without arguing.', 'Confirm the desired resolution and relevant facts.', 'Check for existing cases to avoid duplicate work.', 'Assign an accountable owner and realistic due time.', 'Escalate safety, security, repeated failure or missed commitments.', 'Close only after the outcome and customer communication are recorded.'], 'complaint,recovery,escalation,ownership', 'Published'],
    ['kb-life-boundaries', 'Handling life, relationship and personal-development enquiries', 'general', 'Life & personal development', 'Life & Personal Development', 'Listen respectfully and help the customer clarify the type of support they are seeking. This service is not a substitute for licensed healthcare, therapy, legal advice or emergency response.', ['Use non-judgmental language and avoid moralising.', 'Ask what practical outcome the person is looking for.', 'Offer general educational information and relevant platform resources.', 'Do not diagnose, prescribe treatment or claim to provide therapy.', 'For immediate danger or urgent health concerns, follow the organisation\'s safeguarding and emergency escalation procedure.', 'Record only the minimum necessary information.'], 'life,relationships,parenting,habits,psychology,emotional intelligence,career', 'Published'],
    ['kb-cross-service', 'Relevant RuffNeck service discovery without pressure', 'general', 'Sales & service discovery', 'General Customer Experience', 'Recommend another RuffNeck service only when it directly supports the customer\'s stated objective. A relevant option is more useful than an unrelated pitch.', ['Resolve or progress the customer\'s primary request first.', 'Ask permission before discussing an additional service.', 'Explain the specific use case in neutral terms.', 'Do not promise functions, results or integrations that have not been verified.', 'Record the recommendation and the customer\'s decision.'], 'cross sell,service discovery,ruffneck,recommendation', 'Published'],
    ['kb-lms-access', 'RuffNeck LMS: first-line access checks', 'ruffneck-lms', 'Technical support', 'Technology & software', 'Use these checks for an LMS access enquiry. Confirm the exact error and whether the issue affects one user or a wider group.', ['Confirm the customer is using the RuffNeck LMS site.', 'Ask them to check the address and retry in a current browser.', 'Confirm whether the issue occurs after sign-in or before sign-in.', 'Capture the exact error text and approximate time.', 'Escalate repeated failures with the case reference; never request the user\'s password.'], 'ruffneck lms,access,login,error', 'Published'],
    ['kb-prospector-help', 'RuffNeck Prospector: capturing a platform-support request', 'ruffneck-prospector', 'Technical support', 'Technology & software', 'Collect a concise problem statement and reproducible steps before routing a Prospector issue.', ['Confirm the affected workspace or page.', 'Ask what the user expected to happen.', 'Capture what happened instead and any visible error.', 'Record browser/device details only when relevant.', 'Attach a synthetic or approved reference; avoid exporting unnecessary personal data.'], 'prospector,workspace,technical support', 'Published'],
    ['kb-connect-help', 'RuffNeck Connect: onboarding and connection enquiries', 'ruffneck-connect', 'Product guidance', 'Technology & software', 'Identify whether the enquiry concerns initial setup, account access or a connection failure before choosing the support route.', ['Confirm the requested Connect workflow.', 'Check whether the customer has completed the required setup steps.', 'Capture the point where the process stops.', 'Do not guarantee compatibility or integrations unless verified in the current product documentation.', 'Route unresolved technical faults with the steps already attempted.'], 'connect,onboarding,setup,connection', 'Published'],
    ['kb-social-hub-help', 'RuffNeck Social Hub: campaign and publishing support', 'ruffneck-social-hub', 'Product guidance', 'Technology & software', 'Separate access problems from campaign configuration and publishing issues so the request reaches the correct support queue.', ['Confirm whether the user can access the workspace.', 'Identify the affected campaign or publishing step.', 'Record the time and any visible error.', 'Check whether the request is for platform support or campaign-service advice.', 'Escalate suspected account compromise immediately.'], 'social hub,campaign,publishing,social media', 'Published'],
    ['kb-games-player', 'Kano games: player enquiry and gameplay issue intake', 'kano-run', 'Technical support', 'Technology & software', 'Capture gameplay feedback in a way that enables reproduction. Do not invent live player counts, session totals or service status when telemetry is unavailable.', ['Identify the game: Kano Run or Kano Keke.', 'Capture the page or gameplay stage where the issue occurred.', 'Record device/browser details and approximate time if relevant.', 'Ask whether the issue is repeatable.', 'Route bugs with a clear reproduction summary.', 'Quote player statistics only from an approved, current telemetry source.'], 'kano run,kano keke,game,player count,telemetry,bug', 'Published'],
    ['kb-sponsor-intake', 'Kano games: advertising and sponsorship enquiry intake', 'kano-run', 'Sales & service discovery', 'Technology & software', 'Route advertising and sponsorship requests as commercial enquiries. Do not promise inventory, audience reach, placement or rates without an approved current media pack.', ['Capture organisation and authorised contact details.', 'Ask whether the request concerns sponsorship, in-game placement or another partnership.', 'Record the campaign objective, proposed dates and target audience.', 'Do not guarantee impressions, player counts or conversions.', 'Assign the enquiry to the approved partnerships owner.'], 'advertising,sponsor,sponsorship,kano,commercial', 'Published'],
    ['kb-update-stale', 'What to do when a knowledge article may be out of date', 'general', 'Workplace operations', 'General Customer Experience', 'Do not rely on an article that conflicts with a current product notice or a verified system behaviour.', ['Check the article status and review date.', 'Search current published service notices.', 'Use the verified escalation route when instructions conflict.', 'Flag the article with the exact conflicting step.', 'Do not circulate copied outdated instructions.'], 'stale,outdated,review,article,update', 'Published']
  ];

  function clean(value, max = 800) { return String(value == null ? '' : value).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max); }
  function makeId(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
  function dateString(date) { const d = date instanceof Date ? date : new Date(date || Date.now()); return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10); }
  function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()); }
  function productById(id) { return PRODUCTS.find((item) => item.id === id) || null; }

  function createInitialState(date, academyState) {
    const asOfDate = dateString(date || new Date());
    const articles = SEED_ARTICLES.map((row, index) => ({
      id: row[0], title: row[1], productId: row[2], category: row[3], industry: row[4],
      summary: row[5], steps: row[6].slice(), keywords: row[7], status: row[8], version: 1,
      owner: 'Knowledge Operations', reviewer: 'Service Quality Lead', reviewNote: '',
      createdAt: asOfDate, updatedAt: asOfDate, publishedAt: asOfDate,
      expiresAt: null, views: 0, usageCount: 0, history: [], seedOrder: index
    }));
    return {
      version: VERSION, asOfDate, products: PRODUCTS.map((item) => ({ ...item, topics: item.topics.slice(), related: item.related.slice() })),
      industries: INDUSTRIES.slice(), articles, notices: [], articleUsage: [], activity: [],
      importedBriefings: [], integration: { academyKey: ACADEMY_KEY, lastBriefingImportAt: null, importedBriefings: 0, source: 'Learning & Competency Academy v5.1', mode: 'Manual one-way briefing import' }
    };
  }

  function normaliseState(raw, date) {
    const fresh = createInitialState(date || (raw && raw.asOfDate));
    if (!raw || typeof raw !== 'object') return fresh;
    const state = { ...fresh, ...raw };
    state.products = fresh.products;
    state.industries = fresh.industries;
    state.articles = Array.isArray(raw.articles) ? raw.articles : fresh.articles;
    state.notices = Array.isArray(raw.notices) ? raw.notices : [];
    state.articleUsage = Array.isArray(raw.articleUsage) ? raw.articleUsage : [];
    state.activity = Array.isArray(raw.activity) ? raw.activity : [];
    state.importedBriefings = Array.isArray(raw.importedBriefings) ? raw.importedBriefings : [];
    state.integration = { ...fresh.integration, ...(raw.integration || {}) };
    return state;
  }

  function load(target, date, academyState) {
    if (!target || typeof target.getItem !== 'function') return createInitialState(date, academyState);
    try {
      const raw = JSON.parse(target.getItem(STORAGE_KEY) || 'null');
      return raw ? normaliseState(raw, date) : createInitialState(date, academyState);
    } catch (_) { return createInitialState(date, academyState); }
  }
  function save(state, target) {
    if (!target || typeof target.setItem !== 'function') return false;
    try { target.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch (_) { return false; }
  }
  function activity(state, text, date) {
    state.activity.unshift({ id: makeId('ko-act'), date: dateString(date || state.asOfDate), text: clean(text, 240) });
    state.activity = state.activity.slice(0, 100);
  }
  function getArticle(state, id) { return state.articles.find((item) => item.id === id) || null; }
  function articleIsAvailable(article, date) { return !!article && article.status === 'Published' && (!article.expiresAt || article.expiresAt >= dateString(date)); }
  function searchArticles(state, query, filters = {}, date) {
    const q = clean(query, 160).toLowerCase();
    return state.articles.filter((article) => {
      if (filters.publishedOnly && !articleIsAvailable(article, date || state.asOfDate)) return false;
      if (filters.status && article.status !== filters.status) return false;
      if (filters.productId && article.productId !== filters.productId) return false;
      if (filters.category && article.category !== filters.category) return false;
      if (filters.industry && article.industry !== filters.industry) return false;
      if (!q) return true;
      const haystack = [article.title, article.summary, article.category, article.industry, article.productId, article.keywords, ...(article.steps || [])].join(' ').toLowerCase();
      return haystack.includes(q);
    }).sort((a, b) => {
      const aPub = articleIsAvailable(a, date || state.asOfDate) ? 1 : 0;
      const bPub = articleIsAvailable(b, date || state.asOfDate) ? 1 : 0;
      return bPub - aPub || String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.title.localeCompare(b.title);
    });
  }
  function validateArticle(input) {
    if (!input || clean(input.title, 140).length < 5) throw new Error('Article title must contain at least five characters.');
    if (!CATEGORIES.includes(input.category)) throw new Error('Choose a valid knowledge category.');
    if (input.productId && input.productId !== 'general' && !productById(input.productId)) throw new Error('Choose a valid product or service.');
    if (clean(input.summary, 500).length < 20) throw new Error('Add a summary of at least 20 characters.');
    const steps = Array.isArray(input.steps) ? input.steps.map((x) => clean(x, 260)).filter(Boolean) : String(input.steps || '').split(/\n+/).map((x) => clean(x, 260)).filter(Boolean);
    if (steps.length < 2) throw new Error('Add at least two actionable knowledge steps.');
    if (input.expiresAt && !validDate(input.expiresAt)) throw new Error('Enter a valid article expiry date.');
    return { title: clean(input.title, 140), productId: input.productId || 'general', category: input.category, industry: clean(input.industry || 'General Customer Experience', 80), summary: clean(input.summary, 500), steps, keywords: clean(input.keywords, 240), owner: clean(input.owner || 'Knowledge Operations', 100), reviewer: clean(input.reviewer || 'Service Quality Lead', 100), expiresAt: input.expiresAt || null };
  }
  function createArticle(state, input, date) {
    const fields = validateArticle(input);
    const today = dateString(date || state.asOfDate);
    const article = { id: makeId('kb'), ...fields, status: 'Draft', version: 1, reviewNote: '', createdAt: today, updatedAt: today, publishedAt: null, views: 0, usageCount: 0, history: [] };
    state.articles.unshift(article);
    activity(state, `Draft article created: ${article.title}.`, today);
    return article;
  }
  function updateArticle(state, id, input, date) {
    const article = getArticle(state, id);
    if (!article) throw new Error('Article not found.');
    const fields = validateArticle(input);
    const today = dateString(date || state.asOfDate);
    article.history = Array.isArray(article.history) ? article.history : [];
    article.history.unshift({ version: article.version, title: article.title, summary: article.summary, steps: article.steps.slice(), status: article.status, updatedAt: article.updatedAt, publishedAt: article.publishedAt });
    article.history = article.history.slice(0, 10);
    Object.assign(article, fields, { version: article.version + 1, status: 'Draft', reviewNote: '', updatedAt: today, publishedAt: null });
    activity(state, `Article revised and returned to draft: ${article.title} (v${article.version}).`, today);
    return article;
  }
  function submitForReview(state, id, date) {
    const article = getArticle(state, id);
    if (!article) throw new Error('Article not found.');
    if (!['Draft', 'Changes Requested'].includes(article.status)) throw new Error('Only a draft or returned article can be submitted for review.');
    article.status = 'In Review'; article.updatedAt = dateString(date || state.asOfDate); article.reviewNote = '';
    activity(state, `Article submitted for review: ${article.title}.`, date);
    return article;
  }
  function publishArticle(state, id, reviewer, date) {
    const article = getArticle(state, id);
    if (!article) throw new Error('Article not found.');
    if (article.status !== 'In Review') throw new Error('Only an article in review can be published.');
    article.status = 'Published'; article.reviewer = clean(reviewer || article.reviewer || 'Service Quality Lead', 100);
    article.publishedAt = dateString(date || state.asOfDate); article.updatedAt = article.publishedAt; article.reviewNote = '';
    activity(state, `Article published: ${article.title} (v${article.version}).`, date);
    return article;
  }
  function requestChanges(state, id, note, reviewer, date) {
    const article = getArticle(state, id);
    if (!article) throw new Error('Article not found.');
    if (article.status !== 'In Review') throw new Error('Only an article in review can be returned.');
    const reason = clean(note, 400);
    if (reason.length < 8) throw new Error('Provide a clear review note of at least eight characters.');
    article.status = 'Changes Requested'; article.reviewNote = reason; article.reviewer = clean(reviewer || article.reviewer, 100); article.updatedAt = dateString(date || state.asOfDate);
    activity(state, `Changes requested for article: ${article.title}.`, date);
    return article;
  }
  function recordUsage(state, id, input = {}, date) {
    const article = getArticle(state, id);
    const today = dateString(date || state.asOfDate);
    if (!articleIsAvailable(article, today)) throw new Error('This article is not currently published or has expired.');
    article.views = (article.views || 0) + 1; article.usageCount = (article.usageCount || 0) + 1;
    const usage = { id: makeId('kb-use'), articleId: id, articleTitle: article.title, channel: clean(input.channel || 'Voice', 30), caseRef: clean(input.caseRef || '', 40), outcome: clean(input.outcome || 'Viewed', 40), employee: clean(input.employee || 'Agent', 80), date: today };
    state.articleUsage.unshift(usage); state.articleUsage = state.articleUsage.slice(0, 300);
    activity(state, `Knowledge article used: ${article.title}.`, today);
    return usage;
  }
  function createNotice(state, input, date) {
    if (!input || clean(input.title, 140).length < 5) throw new Error('Enter a service notice title of at least five characters.');
    const severity = ['Information', 'Important', 'Critical'].includes(input.severity) ? input.severity : 'Information';
    const productId = input.productId || 'general';
    if (productId !== 'general' && !productById(productId)) throw new Error('Choose a valid product for this notice.');
    const summary = clean(input.summary, 700);
    if (summary.length < 20) throw new Error('Enter a service update summary of at least 20 characters.');
    const effectiveAt = input.effectiveAt || dateString(date || state.asOfDate);
    if (!validDate(effectiveAt)) throw new Error('Enter a valid effective date.');
    const notice = { id: makeId('notice'), title: clean(input.title, 140), productId, severity, audience: clean(input.audience || 'All customer-care teams', 100), summary, effectiveAt, status: 'Draft', createdAt: dateString(date || state.asOfDate), publishedAt: null, sourceBriefingId: null };
    state.notices.unshift(notice);
    activity(state, `Service notice drafted: ${notice.title}.`, date);
    return notice;
  }
  function publishNotice(state, id, date) {
    const notice = state.notices.find((item) => item.id === id);
    if (!notice) throw new Error('Service notice not found.');
    notice.status = 'Published'; notice.publishedAt = dateString(date || state.asOfDate);
    activity(state, `Service notice published: ${notice.title}.`, date);
    return notice;
  }
  function importBriefings(state, academyState, date) {
    if (!academyState || !Array.isArray(academyState.sessions)) throw new Error('Learning Academy v5.1 briefing records were not found in this browser.');
    const known = new Set(state.importedBriefings);
    const candidates = academyState.sessions.filter((session) => session && session.status !== 'Cancelled' && session.id && !known.has(session.id));
    candidates.forEach((session) => {
      const notice = {
        id: makeId('notice-brief'), title: `Briefing: ${clean(session.topic, 120)}`, productId: 'general',
        severity: 'Information', audience: clean(session.audience === 'all' ? 'All customer-care teams' : session.audience, 100),
        summary: clean(session.summary || `Team briefing scheduled for ${session.time || 'the scheduled time'}. Confirm the changed process with the facilitator and check current published knowledge articles.`, 700),
        effectiveAt: validDate(session.date) ? session.date : dateString(date || state.asOfDate),
        status: 'Published', createdAt: dateString(date || state.asOfDate), publishedAt: dateString(date || state.asOfDate), sourceBriefingId: session.id, sourceTime: session.time || ''
      };
      state.notices.unshift(notice); state.importedBriefings.push(session.id);
    });
    state.integration.lastBriefingImportAt = new Date().toISOString();
    state.integration.importedBriefings = state.importedBriefings.length;
    activity(state, `Imported ${candidates.length} new Learning Academy briefing(s).`, date);
    return { imported: candidates.length, skipped: academyState.sessions.length - candidates.length };
  }
  function getMetrics(state, date) {
    const today = dateString(date || state.asOfDate);
    const validPublished = state.articles.filter((item) => articleIsAvailable(item, today));
    const expired = state.articles.filter((item) => item.status === 'Published' && item.expiresAt && item.expiresAt < today).length;
    return {
      publishedArticles: validPublished.length,
      drafts: state.articles.filter((item) => item.status === 'Draft').length,
      inReview: state.articles.filter((item) => item.status === 'In Review').length,
      changesRequested: state.articles.filter((item) => item.status === 'Changes Requested').length,
      expiredArticles: expired,
      publishedNotices: state.notices.filter((item) => item.status === 'Published').length,
      criticalNotices: state.notices.filter((item) => item.status === 'Published' && item.severity === 'Critical').length,
      productCount: state.products.length,
      articleUsage: state.articleUsage.length
    };
  }
  function exportCSV(state) {
    const rows = [['id','title','product','category','industry','status','version','owner','reviewer','updatedAt','expiresAt','views','usageCount']];
    state.articles.forEach((a) => rows.push([a.id,a.title,a.productId,a.category,a.industry,a.status,a.version,a.owner,a.reviewer,a.updatedAt,a.expiresAt || '',a.views || 0,a.usageCount || 0]));
    return rows.map((row) => row.map((cell) => `"${String(cell == null ? '' : cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  }

  return {
    VERSION, STORAGE_KEY, ACADEMY_KEY, CATEGORIES, PRODUCTS, INDUSTRIES, SEED_ARTICLES,
    createInitialState, normaliseState, load, save, getArticle, articleIsAvailable, searchArticles,
    createArticle, updateArticle, submitForReview, publishArticle, requestChanges, recordUsage,
    createNotice, publishNotice, importBriefings, getMetrics, exportCSV, productById, dateString
  };
});
