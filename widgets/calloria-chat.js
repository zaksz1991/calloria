(function () {
  'use strict';
  var script = document.currentScript || document.querySelector('script[data-calloria-chat]');
  if (!script || window.__CALLORIA_WEB_CHAT__) return;
  var endpoint = (script.dataset.endpoint || '').replace(/\/$/, '');
  var anonKey = script.dataset.anonKey || '';
  var platform = script.dataset.platform || '';
  var allowedPlatforms = ['ruffneck-learn', 'ruffneck-prospector', 'ruffneck-connect', 'ruffneck-social-hub', 'kano-run', 'kano-keke'];
  if (!endpoint || !anonKey || !allowedPlatforms.includes(platform)) {
    console.error('CALLORIA Live Chat is missing its endpoint, public key or platform identifier.');
    return;
  }
  window.__CALLORIA_WEB_CHAT__ = true;

  var help = {
    'ruffneck-learn': { name: 'RuffNeck Learn', url: 'https://ruffneck-lms.vercel.app/', tasks: [
      ['Find a course', 'Browse the course library, open a course to review its subject and level, then follow the enrolment instructions shown on that course page.'],
      ['Choose a learning pathway', 'Start with your goal and current skill level. Confirm course availability and pricing on the live course page.']
    ] },
    'ruffneck-prospector': { name: 'RuffNeck Prospector', url: 'https://ruffneck-prospector.vercel.app/', tasks: [
      ['Discover potential customers', 'Open Discover, enter a service niche and relevant search intent, review the source context, then save relevant results to Prospects or Pipeline.'],
      ['Generate a prospect asset', 'Choose a prospect or campaign context, open Generate, select an available PDF guide or slide deck, and review accuracy before sharing.']
    ] },
    'ruffneck-connect': { name: 'RuffNeck Connect', url: 'https://ruffneck-connect.vercel.app/', tasks: [
      ['Find a community', 'Open the platform, choose Get started or sign in, explore by interest or goal, then follow the community join instructions.'],
      ['Post a need or offer', 'Open a relevant community, describe the need or contribution clearly, add practical details and publish through the platform.']
    ] },
    'ruffneck-social-hub': { name: 'RuffNeck Social Hub', url: 'https://ruffneck-social-hub.vercel.app/', tasks: [
      ['Access your workspace', 'Select Sign in and use the account associated with the organisation. Ask the organisation administrator to verify membership and role if access is denied.']
    ] },
    'kano-run': { name: 'Kano Run / Kano Life', url: 'https://kano-run.vercel.app/', tasks: [
      ['Start playing', 'Choose a route, driver and mode, select Start Driving, then use A/D, arrow keys or touch controls to change lanes.'],
      ['Resolve a performance issue', 'Pause the game, check browser compatibility and available memory, then reload if the session is unresponsive. Report the device, browser and game mode if the issue persists.']
    ] },
    'kano-keke': { name: 'Kano Keke', url: 'https://kano-keke.vercel.app/', tasks: [
      ['Start a shift', 'Select a driver, route, keke, road and game mode. Review the tutorial if needed, then select Start Shift.'],
      ['Garage and rewards', 'Review the daily reward and the options currently displayed in Garajin Keke Shop. Confirm current availability and costs in the live game.']
    ] }
  };
  var product = help[platform];
  var storageKey = 'calloria.webchat.v1.' + location.host;
  var session = null;
  var pollTimer = null;
  var rootHost = document.createElement('div');
  rootHost.id = 'calloria-web-chat-host';
  document.body.appendChild(rootHost);
  var shadow = rootHost.attachShadow({ mode: 'open' });
  var style = document.createElement('style');
  style.textContent = `
    :host{all:initial} *{box-sizing:border-box} .launcher{position:fixed;z-index:2147483000;right:20px;bottom:20px;border:0;border-radius:999px;background:#0c2437;color:#fff;padding:14px 20px;font:700 14px/1.2 system-ui,sans-serif;box-shadow:0 10px 32px #06131c66;cursor:pointer;display:flex;align-items:center;gap:10px}.launcher:focus-visible,button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid #48c9d6;outline-offset:2px}.dot{width:10px;height:10px;border-radius:50%;background:#42d5a5}.panel{position:fixed;z-index:2147483000;right:20px;bottom:82px;width:min(390px,calc(100vw - 28px));height:min(630px,calc(100dvh - 112px));background:#f5f8fb;border:1px solid #d9e3eb;border-radius:20px;box-shadow:0 18px 60px #05172840;overflow:hidden;display:none;color:#142d3e;font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}.panel.open{display:flex;flex-direction:column}.header{display:flex;align-items:center;justify-content:space-between;background:#0c2437;color:#fff;padding:15px 17px}.brand{display:flex;align-items:center;gap:11px}.brand-mark{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:#1d536b;color:#fff;font-weight:800}.brand strong{display:block;font-size:14px}.brand small{display:block;color:#b9cbd6;font-size:10px;letter-spacing:.11em}.close{border:0;background:transparent;color:#fff;font-size:24px;cursor:pointer;padding:2px 7px}.content{padding:16px;overflow:auto;flex:1}.eyebrow{color:#557187;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.intro{margin:4px 0 14px;font-size:17px;font-weight:750;color:#132d40}.muted{color:#607789;font-size:12px}.help-card{background:#fff;border:1px solid #dce6ec;border-radius:13px;padding:12px;margin:9px 0}.help-card strong{display:block;font-size:13px}.help-card p{margin:6px 0 0;color:#536b7c;font-size:12px}.help-link{display:inline-block;margin-top:9px;color:#087f91;font-weight:750;text-decoration:none;font-size:12px}.primary,.secondary,.send{border:0;border-radius:10px;padding:11px 14px;font:700 13px system-ui,sans-serif;cursor:pointer}.primary,.send{background:#087f91;color:#fff}.secondary{background:#e6eef3;color:#17384d}.full{width:100%;margin-top:10px}.form{display:grid;gap:10px}.field{display:grid;gap:5px}.field label{font-size:12px;font-weight:700;color:#335166}.field input,.field select,.field textarea{width:100%;border:1px solid #cddbe4;background:#fff;border-radius:9px;padding:10px;color:#142d3e;font:13px system-ui,sans-serif}.field textarea{resize:vertical;min-height:108px}.consent{display:flex;gap:8px;align-items:flex-start;color:#536b7c;font-size:11px}.consent input{margin-top:2px}.notice{background:#fff6df;border:1px solid #f2d995;border-radius:10px;padding:9px;color:#74531c;font-size:11px}.status{font-size:12px;color:#526b7c;min-height:18px;margin-top:6px}.status.error{color:#a92d36}.chat-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 13px;background:#e9f1f5;border-bottom:1px solid #d7e2e9;font-size:11px;color:#496578}.badge{font-weight:800;color:#087f91}.messages{display:flex;flex-direction:column;gap:9px;padding:13px;overflow:auto;flex:1;background:#f1f6f9}.bubble{max-width:86%;padding:10px 12px;border-radius:13px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}.bubble.customer{align-self:flex-end;background:#d7edf0;color:#173c4b;border-bottom-right-radius:4px}.bubble.agent{align-self:flex-start;background:#fff;border:1px solid #dce6ec;color:#173347;border-bottom-left-radius:4px}.bubble small{display:block;margin-top:5px;color:#688092;font-size:10px}.composer{padding:11px;border-top:1px solid #d7e2e9;background:#fff;display:flex;gap:8px;align-items:flex-end}.composer textarea{flex:1;resize:none;min-height:44px;max-height:110px;border:1px solid #cddbe4;border-radius:10px;padding:10px;font:13px system-ui,sans-serif}.send{min-height:44px}.foot{padding:7px 12px;background:#fff;color:#718796;font-size:10px;text-align:center;border-top:1px solid #e3ebf0}.back{border:0;background:transparent;color:#087f91;font:700 12px system-ui;cursor:pointer;padding:0;margin-bottom:11px}.empty{padding:16px;text-align:center;color:#647c8b;font-size:12px}@media(max-width:520px){.launcher{right:14px;bottom:14px}.panel{right:8px;bottom:76px;width:calc(100vw - 16px);height:min(700px,calc(100dvh - 88px));border-radius:17px}.content{padding:13px}}
  `;
  shadow.appendChild(style);
  var launcher = document.createElement('button'); launcher.className = 'launcher'; launcher.type = 'button'; launcher.setAttribute('aria-label', 'Open RuffNeck customer support chat');
  var dot = document.createElement('span'); dot.className = 'dot'; var launchText = document.createElement('span'); launchText.textContent = 'Chat with support'; launcher.append(dot, launchText);
  var panel = document.createElement('section'); panel.className = 'panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'RuffNeck customer support'); panel.setAttribute('aria-modal', 'false');
  var header = document.createElement('header'); header.className = 'header';
  var brand = document.createElement('div'); brand.className = 'brand'; var mark = document.createElement('span'); mark.className = 'brand-mark'; mark.textContent = 'R';
  var brandText = document.createElement('span'); var title = document.createElement('strong'); title.textContent = 'RuffNeck Support'; var subtitle = document.createElement('small'); subtitle.textContent = product.name.toUpperCase(); brandText.append(title, subtitle); brand.append(mark, brandText);
  var close = document.createElement('button'); close.className = 'close'; close.type = 'button'; close.setAttribute('aria-label', 'Minimise chat'); close.textContent = '×'; header.append(brand, close);
  var content = document.createElement('div'); content.className = 'content';
  panel.append(header, content);
  shadow.append(launcher, panel);

  function node(tag, className, text) { var el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
  function showView(view) {
    content.replaceChildren();
    if (view === 'home') {
      content.append(node('div', 'eyebrow', 'SELF-SERVICE FIRST'));
      content.append(node('h2', 'intro', 'What would you like help with?'));
      content.append(node('p', 'muted', 'Try these quick steps or start a private conversation with the customer-care team.'));
      product.tasks.forEach(function (task) { var card = node('article', 'help-card'); card.append(node('strong', '', task[0]), node('p', '', task[1])); content.append(card); });
      var open = node('a', 'help-link', 'Open ' + product.name + ' in a new tab ↗'); open.href = product.url; open.target = '_blank'; open.rel = 'noopener noreferrer'; content.append(open);
      var talk = node('button', 'primary full', 'Talk to customer care'); talk.type = 'button'; talk.addEventListener('click', function () { showView('form'); }); content.append(talk);
      content.append(node('div', 'notice', 'Never share passwords, PINs, OTPs, recovery codes, API keys or payment-card security codes in chat. CALLORIA support is not an emergency service.'));
    } else if (view === 'form') {
      var back = node('button', 'back', '← Back to self-service'); back.type = 'button'; back.addEventListener('click', function () { showView('home'); }); content.append(back);
      content.append(node('div', 'eyebrow', 'START A PRIVATE SUPPORT CHAT'));
      content.append(node('h2', 'intro', 'Tell us what you need'));
      var form = node('form', 'form');
      var topicWrap = node('div', 'field'); topicWrap.append(node('label', '', 'Topic')); var topic = document.createElement('select'); topic.required = true;
      [['platform_support','Platform or product support'],['account_access','Account access'],['technical_support','Technical problem'],['sales_enquiry','Product or service enquiry'],['complaint','Complaint or service recovery'],['personal_guidance','Life or personal guidance'],['safeguarding','Safety or safeguarding'],['learning_career','Learning or career development'],['social_media','Social media support'],['general','General enquiry']].forEach(function (option) { var item = document.createElement('option'); item.value = option[0]; item.textContent = option[1]; topic.append(item); }); topicWrap.append(topic);
      var langWrap = node('div', 'field'); langWrap.append(node('label', '', 'Preferred language')); var language = document.createElement('select');
      [['en','English'],['ha','Hausa'],['yo','Yoruba'],['ig','Igbo'],['pcm','Nigerian Pidgin']].forEach(function (option) { var item = document.createElement('option'); item.value = option[0]; item.textContent = option[1]; language.append(item); }); langWrap.append(language);
      var messageWrap = node('div', 'field'); messageWrap.append(node('label', '', 'Your message')); var message = document.createElement('textarea'); message.required = true; message.maxLength = 3000; message.placeholder = 'Describe the issue and what you have already tried. Do not include passwords or one-time codes.'; messageWrap.append(message);
      var consent = node('label', 'consent'); var check = document.createElement('input'); check.type = 'checkbox'; check.required = true; var consentText = node('span', '', 'I agree that this chat and its messages may be stored in encrypted form and shared with authorised RuffNeck support staff to handle this request.'); consent.append(check, consentText);
      var submit = node('button', 'primary full', 'Start chat'); submit.type = 'submit'; var status = node('div', 'status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
      form.append(topicWrap, langWrap, messageWrap, consent, submit, status);
      form.addEventListener('submit', async function (event) { event.preventDefault(); submit.disabled = true; status.textContent = 'Connecting to customer care…'; status.className = 'status'; try {
        var result = await api('start_chat', { platformId: platform, intent: topic.value, language: language.value, message: message.value, consent: check.checked });
        session = { id: result.conversationId, ref: result.conversationRef, token: result.visitorToken, createdAt: Date.now() }; saveSession(); showView('chat'); await refreshHistory(); startPolling();
      } catch (error) { status.textContent = error.message || 'The chat could not be started.'; status.className = 'status error'; } finally { submit.disabled = false; } });
      content.append(form);
    }
  }
  function saveSession() { try { if (session) sessionStorage.setItem(storageKey, JSON.stringify(session)); } catch (_) {} }
  function clearSession() { session = null; try { sessionStorage.removeItem(storageKey); } catch (_) {} stopPolling(); }
  function restoreSession() { try { var stored = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); if (stored && typeof stored.id === 'string' && typeof stored.token === 'string' && Date.now() - Number(stored.createdAt || 0) < 7 * 24 * 60 * 60 * 1000) session = stored; else sessionStorage.removeItem(storageKey); } catch (_) { session = null; } }
  async function api(action, payload) {
    var response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anonKey }, body: JSON.stringify(Object.assign({ action: action }, payload || {})) });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || 'Support chat request failed (' + response.status + ').');
    return data;
  }
  function renderMessages(messages) {
    var meta = node('div', 'chat-meta'); var ref = node('span', '', 'Reference ' + session.ref); var badge = node('strong', 'badge', 'Connecting…'); meta.append(ref, badge);
    var list = node('div', 'messages');
    messages.forEach(function (message) { var bubble = node('article', 'bubble ' + (message.direction === 'customer' ? 'customer' : 'agent')); bubble.append(node('div', '', message.text)); bubble.append(node('small', '', (message.direction === 'customer' ? 'You' : 'RuffNeck support') + ' · ' + new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))); list.append(bubble); });
    var composer = node('form', 'composer'); var input = document.createElement('textarea'); input.rows = 1; input.maxLength = 3000; input.placeholder = 'Write a message…'; input.setAttribute('aria-label', 'Write a message'); var send = node('button', 'send', 'Send'); send.type = 'submit'; composer.append(input, send);
    var pendingMessageId = null;
    composer.addEventListener('submit', async function (event) { event.preventDefault(); var text = input.value.trim(); if (!text) return; if (!pendingMessageId) pendingMessageId = crypto.randomUUID(); send.disabled = true; input.disabled = true; try { await api('send_message', { conversationId: session.id, visitorToken: session.token, clientMessageId: pendingMessageId, message: text }); pendingMessageId = null; input.value = ''; await refreshHistory(); } catch (error) { badge.textContent = error.message + ' Your draft is retained; retrying will not duplicate a message already accepted.'; badge.style.color = '#a92d36'; } finally { send.disabled = false; input.disabled = false; input.focus(); } });
    content.replaceChildren(meta, list, composer, node('div', 'foot', 'Encrypted session · Keep this browser tab open for replies.'));
    return { badge: badge, list: list, composer: composer };
  }
  var currentBadge = null;
  async function refreshHistory() {
    if (!session) return;
    var data = await api('history', { conversationId: session.id, visitorToken: session.token });
    var view = renderMessages(data.messages || []); currentBadge = view.badge;
    var state = data.conversation.status;
    currentBadge.textContent = state === 'agent_connected' ? 'Agent connected' : state === 'completed' || state === 'closed' ? 'Conversation closed' : 'Waiting for an agent';
    if (data.conversation.status === 'completed' || data.conversation.status === 'closed') {
      var next = node('button', 'secondary full', 'Start another chat'); next.type = 'button'; next.addEventListener('click', function () { clearSession(); showView('form'); }); content.append(next);
      var inputs = content.querySelectorAll('.composer textarea,.composer button'); inputs.forEach(function (el) { el.disabled = true; });
      stopPolling();
    }
  }
  function startPolling() { stopPolling(); pollTimer = window.setInterval(function () { if (session && panel.classList.contains('open') && !document.hidden) refreshHistory().catch(function (error) { if (currentBadge) currentBadge.textContent = error.message; }); }, 6000); }
  function stopPolling() { if (pollTimer) window.clearInterval(pollTimer); pollTimer = null; }
  function openPanel() { panel.classList.add('open'); launcher.setAttribute('aria-expanded', 'true'); if (session) { showView('chat'); refreshHistory().then(startPolling).catch(function () { clearSession(); showView('home'); }); } else showView('home'); }
  function closePanel() { panel.classList.remove('open'); launcher.setAttribute('aria-expanded', 'false'); stopPolling(); }
  launcher.setAttribute('aria-expanded', 'false'); launcher.addEventListener('click', function () { panel.classList.contains('open') ? closePanel() : openPanel(); }); close.addEventListener('click', closePanel);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && session && panel.classList.contains('open')) refreshHistory().catch(function () {}); });
  restoreSession();
})();
