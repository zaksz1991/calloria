export const CALLORIA_TRY_IT_DEMOS = Object.freeze({
  learn: Object.freeze({
    platformId: 'ruffneck-learn',
    name: 'RuffNeck Learn',
    url: 'https://ruffneck-lms.vercel.app/',
    intentUrl: '/support-router.html?platform=ruffneck-learn&intent=sales_enquiry',
    intro: 'A short learning-design exercise using a fictional learner. This is an educational preview, not a live LMS connection.',
    tasks: Object.freeze([
      Object.freeze({
        prompt: 'A learner has 30 minutes and wants to improve a practical digital skill. What should they decide first?',
        options: Object.freeze([
          Object.freeze({ label: 'The outcome they want to achieve', correct: true, feedback: 'Correct. A clear learning outcome makes it easier to choose relevant lessons and judge progress.' }),
          Object.freeze({ label: 'How many videos they can open', correct: false, feedback: 'Start with the skill or outcome. The number of videos does not show whether learning happened.' }),
          Object.freeze({ label: 'A certificate before choosing a topic', correct: false, feedback: 'Choose the skill and outcome first. Recognition should not replace practical learning.' })
        ])
      }),
      Object.freeze({
        prompt: 'After a short lesson, which activity gives the learner useful evidence of progress?',
        options: Object.freeze([
          Object.freeze({ label: 'Re-read the lesson title', correct: false, feedback: 'A title is not evidence of skill. The learner needs to apply or explain what they learned.' }),
          Object.freeze({ label: 'Complete a small task and review the result', correct: true, feedback: 'Correct. Practice followed by feedback helps reveal what the learner can actually do.' }),
          Object.freeze({ label: 'Skip practice and move to another topic', correct: false, feedback: 'Practice helps turn information into a usable skill.' })
        ])
      })
    ])
  }),
  prospector: Object.freeze({
    platformId: 'ruffneck-prospector',
    name: 'RuffNeck Prospector',
    url: 'https://ruffneck-prospector.vercel.app/',
    intentUrl: '/support-router.html?platform=ruffneck-prospector&intent=sales_enquiry',
    intro: 'A fictional lead-qualification exercise. It demonstrates sound prospecting judgement; it does not connect to the live Prospector workspace.',
    tasks: Object.freeze([
      Object.freeze({
        prompt: 'A small retailer says they want more online orders but has not explained their current sales process. What is the best next move?',
        options: Object.freeze([
          Object.freeze({ label: 'Ask focused questions about their goal, audience and current process', correct: true, feedback: 'Correct. Qualification begins by understanding the business need before recommending a solution.' }),
          Object.freeze({ label: 'Immediately promise a specific increase in sales', correct: false, feedback: 'Never promise an outcome without evidence. First understand the business and its needs.' }),
          Object.freeze({ label: 'Collect every personal detail you can find', correct: false, feedback: 'Collect only relevant, appropriate information. More personal data does not make a lead better qualified.' })
        ])
      }),
      Object.freeze({
        prompt: 'The retailer asks you to contact them next week. What should a responsible prospecting note contain?',
        options: Object.freeze([
          Object.freeze({ label: 'The agreed follow-up date, business need and permission to contact', correct: true, feedback: 'Correct. A useful note records context and the agreed next step without unnecessary sensitive details.' }),
          Object.freeze({ label: 'A guessed budget and an unconfirmed promise', correct: false, feedback: 'Do not record guesses as facts. Mark unknown information as unconfirmed.' }),
          Object.freeze({ label: 'Passwords or account recovery codes', correct: false, feedback: 'Never request or store passwords, PINs, OTPs or recovery codes in a prospecting note.' })
        ])
      })
    ])
  }),
  connect: Object.freeze({
    platformId: 'ruffneck-connect',
    name: 'RuffNeck Connect',
    url: 'https://ruffneck-connect.vercel.app/',
    intentUrl: '/support-router.html?platform=ruffneck-connect&intent=sales_enquiry',
    intro: 'A fictional community-collaboration exercise. It illustrates constructive participation and is not a live community session.',
    tasks: Object.freeze([
      Object.freeze({
        prompt: 'A new community member says they are unsure where to begin. What response is most helpful?',
        options: Object.freeze([
          Object.freeze({ label: 'Welcome them, clarify their goal and point them to a relevant starting place', correct: true, feedback: 'Correct. A useful welcome reduces friction and gives the person a clear next step.' }),
          Object.freeze({ label: 'Tell them to read every message before asking anything', correct: false, feedback: 'That creates unnecessary friction. Give a clear, relevant starting point.' }),
          Object.freeze({ label: 'Ignore the question because they are new', correct: false, feedback: 'Constructive communities make it easier for new members to participate.' })
        ])
      }),
      Object.freeze({
        prompt: 'Two members disagree about a shared task. What should a facilitator do first?',
        options: Object.freeze([
          Object.freeze({ label: 'Take sides immediately', correct: false, feedback: 'Taking sides can intensify conflict. Establish the issue and shared objective first.' }),
          Object.freeze({ label: 'Restate the shared goal, clarify the facts and agree on a next action', correct: true, feedback: 'Correct. Calm clarification helps turn disagreement into a workable decision.' }),
          Object.freeze({ label: 'Publish their private messages to the whole group', correct: false, feedback: 'Respect privacy. Share only what is appropriate and authorised.' })
        ])
      })
    ])
  }),
  social: Object.freeze({
    platformId: 'ruffneck-social-hub',
    name: 'RuffNeck Social Hub',
    url: 'https://ruffneck-social-hub.vercel.app/',
    intentUrl: '/support-router.html?platform=ruffneck-social-hub&intent=sales_enquiry',
    intro: 'A fictional social-campaign planning exercise. It teaches basic campaign decisions without connecting to live accounts or publishing content.',
    tasks: Object.freeze([
      Object.freeze({
        prompt: 'A local food business wants more people nearby to place orders. What should the campaign define first?',
        options: Object.freeze([
          Object.freeze({ label: 'A measurable objective and the audience it wants to reach', correct: true, feedback: 'Correct. A clear objective and audience guide the message, channel and measurement.' }),
          Object.freeze({ label: 'A large number of unrelated posts', correct: false, feedback: 'More posts do not automatically produce results. Plan around a defined objective.' }),
          Object.freeze({ label: 'A follower target unrelated to orders', correct: false, feedback: 'Followers may be useful, but the chosen metric should reflect the business objective.' })
        ])
      }),
      Object.freeze({
        prompt: 'The campaign is running. Which measure best indicates whether it is helping generate orders?',
        options: Object.freeze([
          Object.freeze({ label: 'The number of decorative graphics created', correct: false, feedback: 'Production volume is not the outcome. Measure meaningful audience actions.' }),
          Object.freeze({ label: 'Tracked enquiries or orders linked to the campaign', correct: true, feedback: 'Correct. Track the actions that connect the campaign to its stated objective.' }),
          Object.freeze({ label: 'The number of hours the team spent online', correct: false, feedback: 'Time online does not show whether the campaign generated useful outcomes.' })
        ])
      })
    ])
  }),
  kanoRun: Object.freeze({
    platformId: 'kano-run',
    name: 'Kano Run / Kano Life',
    url: 'https://kano-run.vercel.app/',
    intentUrl: '/support-router.html?platform=kano-run&intent=sales_enquiry',
    intro: 'A short road-awareness scenario inspired by driving simulations. It is a fictional educational sample, not a substitute for driver training or local traffic rules.',
    tasks: Object.freeze([
      Object.freeze({
        prompt: 'In the simulation, you approach a pedestrian crossing and someone is waiting to cross. What is the safest response?',
        options: Object.freeze([
          Object.freeze({ label: 'Reduce speed and yield when required, checking the crossing is clear', correct: true, feedback: 'Correct. Anticipate pedestrians, slow down and give them a safe crossing.' }),
          Object.freeze({ label: 'Accelerate to pass before they step forward', correct: false, feedback: 'Do not rush a crossing. Protect vulnerable road users and obey traffic controls.' }),
          Object.freeze({ label: 'Look only at the vehicle directly ahead', correct: false, feedback: 'Scan the road environment, including pedestrians, signs and surrounding traffic.' })
        ])
      }),
      Object.freeze({
        prompt: 'Visibility becomes poor during a journey. What is the best response?',
        options: Object.freeze([
          Object.freeze({ label: 'Increase speed to leave the area quickly', correct: false, feedback: 'Poor visibility requires more caution, not more speed.' }),
          Object.freeze({ label: 'Adjust speed, increase following distance and use appropriate lights', correct: true, feedback: 'Correct. Adapt to conditions and keep enough space to react safely.' }),
          Object.freeze({ label: 'Follow the vehicle ahead more closely', correct: false, feedback: 'Following closely reduces reaction time. Increase the safe distance.' })
        ])
      })
    ])
  }),
  kanoKeke: Object.freeze({
    platformId: 'kano-keke',
    name: 'Kano Keke',
    url: 'https://kano-keke.vercel.app/',
    intentUrl: '/support-router.html?platform=kano-keke&intent=sales_enquiry',
    intro: 'A fictional passenger-service scenario for a Keke simulation. It is an educational sample, not an actual transport booking or fare quote.',
    tasks: Object.freeze([
      Object.freeze({
        prompt: 'A passenger gives a destination but you are unsure which route they expect. What should happen before the trip?',
        options: Object.freeze([
          Object.freeze({ label: 'Confirm the destination and agree the fare before departure', correct: true, feedback: 'Correct. Clear agreement avoids misunderstandings and helps the passenger make an informed choice.' }),
          Object.freeze({ label: 'Start moving and decide the fare later', correct: false, feedback: 'Agree the route and fare before departure. Do not create avoidable disputes.' }),
          Object.freeze({ label: 'Guess the destination from the passenger’s appearance', correct: false, feedback: 'Never assume. Ask and confirm the passenger’s stated destination.' })
        ])
      }),
      Object.freeze({
        prompt: 'A passenger asks you to carry more people than the vehicle is approved to carry. What should you do?',
        options: Object.freeze([
          Object.freeze({ label: 'Accept because the passenger insists', correct: false, feedback: 'Passenger pressure does not override safety or legal capacity.' }),
          Object.freeze({ label: 'Refuse the unsafe request and explain the capacity limit calmly', correct: true, feedback: 'Correct. Follow the approved capacity and prioritise safe transport.' }),
          Object.freeze({ label: 'Ask passengers to decide whether the risk is acceptable', correct: false, feedback: 'Safety requirements are not optional or transferable to passengers.' })
        ])
      })
    ])
  })
});

const HTML_MARKER = 'data-calloria-try-it-studio="v6.58"';
const CARD_ACTION_ANCHOR = '      actions.append(open, ask, request, help);';
const GOAL_ANCHOR = '  <fieldset class="calloria-discovery-goals">';

const progressMarkup = `
  <div class="calloria-tryit-strip" data-calloria-tryit-strip>
    <div class="calloria-tryit-copy"><strong>Try before you choose</strong><small>Short, fictional previews. No account or payment details.</small></div>
    <div class="calloria-tryit-progress" role="status" aria-live="polite"><strong data-calloria-tryit-count>0 / 6</strong><small>previews completed · kept in this browser</small></div>
    <button type="button" class="calloria-tryit-all" data-calloria-tryit-all>Explore all previews</button>
  </div>`;

const studioStyles = `
<style id="calloria-try-it-studio-v658">
.calloria-tryit-strip{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px 12px;align-items:center;margin:12px 0;padding:11px;border:1px solid rgba(98,214,197,.26);border-radius:11px;background:linear-gradient(110deg,rgba(31,119,114,.17),rgba(8,24,37,.6))}
.calloria-tryit-copy strong{display:block;color:#eaf9f8;font:800 10px/1.35 Manrope,sans-serif}.calloria-tryit-copy small,.calloria-tryit-progress small{display:block;margin-top:3px;color:#91acb8;font:500 8px/1.45 "DM Sans",sans-serif}
.calloria-tryit-progress{text-align:right}.calloria-tryit-progress strong{color:#72e3d2;font:800 12px Manrope,sans-serif}
.calloria-tryit-all{grid-column:1/-1;min-height:34px;border:1px solid rgba(93,218,205,.4);border-radius:8px;background:rgba(41,190,174,.1);color:#b9f3e9;font:800 9px Manrope,sans-serif;cursor:pointer}
.calloria-discovery-product-actions button.calloria-discovery-preview-link{border-color:rgba(124,224,183,.42);background:rgba(90,193,137,.12);color:#bdf2d5}
.calloria-discovery-product-actions button.calloria-discovery-preview-link:hover{background:rgba(90,193,137,.2)}
.calloria-tryit-dialog{width:min(620px,calc(100vw - 24px));max-width:620px;max-height:min(86dvh,760px);padding:0;border:1px solid rgba(103,219,208,.3);border-radius:16px;background:#081722;color:#edf7f7;box-shadow:0 24px 90px rgba(0,0,0,.55)}
.calloria-tryit-dialog::backdrop{background:rgba(0,8,14,.78);backdrop-filter:blur(5px)}
.calloria-tryit-dialog[open]{display:block}.calloria-tryit-panel{padding:clamp(15px,3vw,24px)}
.calloria-tryit-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:13px;border-bottom:1px solid rgba(172,206,219,.14)}
.calloria-tryit-eyebrow{color:#70ddcf;font:800 8px Manrope,sans-serif;letter-spacing:.15em}.calloria-tryit-title{margin:5px 0 0;color:#f0fbfb;font:800 clamp(18px,4vw,24px)/1.18 Manrope,sans-serif}.calloria-tryit-close{flex:0 0 auto;width:34px;height:34px;border:1px solid rgba(172,206,219,.2);border-radius:9px;background:rgba(255,255,255,.04);color:#d5e7ec;font-size:19px;cursor:pointer}
.calloria-tryit-intro{margin:12px 0;color:#a9c0c8;font:500 10px/1.55 "DM Sans",sans-serif}.calloria-tryit-step{margin:16px 0 8px;color:#7fe2d7;font:800 9px Manrope,sans-serif;letter-spacing:.08em}.calloria-tryit-question{margin:0 0 12px;color:#edf7f8;font:700 14px/1.5 Manrope,sans-serif}
.calloria-tryit-options{display:grid;gap:8px}.calloria-tryit-option{width:100%;min-height:46px;padding:10px 12px;border:1px solid rgba(172,206,219,.19);border-radius:9px;background:rgba(255,255,255,.035);color:#d7e8ec;text-align:left;font:600 10px/1.45 "DM Sans",sans-serif;cursor:pointer}.calloria-tryit-option:hover,.calloria-tryit-option:focus-visible{border-color:#72d9cc;outline:2px solid rgba(114,217,204,.25);outline-offset:1px}.calloria-tryit-option:disabled{cursor:default;opacity:.88}.calloria-tryit-option[data-correct="true"]{border-color:#53d49b;background:rgba(35,168,111,.16)}.calloria-tryit-option[data-correct="false"]{border-color:rgba(219,167,91,.35)}
.calloria-tryit-feedback{min-height:38px;margin:11px 0 0;padding:10px;border-radius:8px;background:rgba(67,138,145,.12);color:#c1dadd;font:500 10px/1.5 "DM Sans",sans-serif}.calloria-tryit-feedback[hidden]{display:none}
.calloria-tryit-footer{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:14px}.calloria-tryit-local-note{max-width:60%;color:#7896a4;font:500 8px/1.45 "DM Sans",sans-serif}.calloria-tryit-next,.calloria-tryit-primary{min-height:38px;padding:9px 13px;border:0;border-radius:8px;background:linear-gradient(100deg,#25c5ca,#5ad7b5);color:#06242b;font:800 9px Manrope,sans-serif;cursor:pointer}.calloria-tryit-next:disabled{opacity:.42;cursor:not-allowed}
.calloria-tryit-result{padding:17px 0 4px}.calloria-tryit-score{margin:8px 0;color:#7fe2d7;font:800 26px Manrope,sans-serif}.calloria-tryit-result p{color:#afc6cc;font:500 10px/1.6 "DM Sans",sans-serif}.calloria-tryit-result-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:15px}.calloria-tryit-result-actions a,.calloria-tryit-result-actions button{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:9px 12px;border:1px solid rgba(111,218,204,.35);border-radius:8px;background:rgba(62,175,158,.1);color:#c4f3eb;text-decoration:none;font:800 9px Manrope,sans-serif;cursor:pointer}.calloria-tryit-result-actions a:first-child{border:0;background:linear-gradient(100deg,#25c5ca,#5ad7b5);color:#06242b}
.calloria-tryit-dialog button:focus-visible,.calloria-tryit-dialog a:focus-visible{outline:2px solid #84eee0;outline-offset:3px}
@media(max-width:440px){.calloria-tryit-strip{grid-template-columns:minmax(0,1fr) auto}.calloria-tryit-progress small{max-width:96px}.calloria-tryit-footer{align-items:flex-end}.calloria-tryit-local-note{max-width:52%}.calloria-tryit-result-actions>*{flex:1 1 100%}}
@media(prefers-reduced-motion:reduce){.calloria-tryit-dialog *{scroll-behavior:auto!important}}
</style>`;

const studioScript = `
<script id="calloria-try-it-studio-script-v658">
(() => {
  const root = document.getElementById('calloria-discovery-guide');
  if (!root || root.dataset.tryItInitialized === 'true') return;
  root.dataset.tryItInitialized = 'true';
  const demos = ${JSON.stringify(CALLORIA_TRY_IT_DEMOS)};
  const storageKey = 'calloria.public.tryit.v1';
  const ids = Object.keys(demos);
  const countNode = root.querySelector('[data-calloria-tryit-count]');
  let memoryProgress = {};
  let activeId = '';
  let activeStep = 0;
  let activeScore = 0;
  let lastTrigger = null;
  let answered = false;

  const readProgress = () => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        memoryProgress = Object.fromEntries(ids.filter(id => parsed[id] && parsed[id].completed === true).map(id => [id, {
          completed: true,
          attempts: Math.max(1, Math.min(999, Number(parsed[id].attempts) || 1)),
          bestScore: Math.max(0, Math.min(2, Number(parsed[id].bestScore) || 0)),
          completedAt: typeof parsed[id].completedAt === 'string' ? parsed[id].completedAt : ''
        }]));
      }
    } catch { /* Private browsing or storage restrictions: keep progress in memory. */ }
    return memoryProgress;
  };
  const writeProgress = () => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(memoryProgress)); }
    catch { /* The preview remains usable without persistent storage. */ }
    updateProgress();
  };
  const updateProgress = () => {
    if (!countNode) return;
    const completed = ids.filter(id => memoryProgress[id]?.completed).length;
    countNode.textContent = completed + ' / ' + ids.length;
    root.querySelectorAll('[data-calloria-preview]').forEach(button => {
      const done = memoryProgress[button.dataset.calloriaPreview]?.completed === true;
      button.textContent = done ? 'Replay preview' : 'Try a quick preview';
    });
    const strip = root.querySelector('[data-calloria-tryit-strip]');
    if (strip) strip.setAttribute('aria-label', completed + ' of ' + ids.length + ' quick previews completed. Progress stays in this browser and is not sent to a server.');
  };
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const dialog = make('dialog', 'calloria-tryit-dialog');
  dialog.setAttribute('aria-labelledby', 'calloria-tryit-title-v658');
  dialog.innerHTML = '';
  const panel = make('div', 'calloria-tryit-panel');
  const head = make('div', 'calloria-tryit-head');
  const titleWrap = make('div');
  titleWrap.append(make('div', 'calloria-tryit-eyebrow', 'RUFFNECK QUICK PREVIEW'));
  const title = make('h2', 'calloria-tryit-title', 'Try a sample');
  title.id = 'calloria-tryit-title-v658';
  titleWrap.append(title);
  const close = make('button', 'calloria-tryit-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close preview');
  head.append(titleWrap, close);
  const intro = make('p', 'calloria-tryit-intro');
  const body = make('div', 'calloria-tryit-body');
  panel.append(head, intro, body);
  dialog.append(panel);
  document.body.append(dialog);

  const closeDialog = () => {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
  };
  close.addEventListener('click', closeDialog);
  dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(); });
  dialog.addEventListener('close', () => { if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus(); });

  const renderStep = () => {
    const demo = demos[activeId];
    if (!demo) return;
    answered = false;
    body.replaceChildren();
    const task = demo.tasks[activeStep];
    body.append(make('div', 'calloria-tryit-step', 'CHALLENGE ' + (activeStep + 1) + ' OF ' + demo.tasks.length));
    body.append(make('h3', 'calloria-tryit-question', task.prompt));
    const options = make('div', 'calloria-tryit-options');
    options.setAttribute('role', 'group');
    options.setAttribute('aria-label', 'Choose the best response');
    const feedback = make('p', 'calloria-tryit-feedback', 'Choose an answer to see why it works.');
    feedback.hidden = true;
    const footer = make('div', 'calloria-tryit-footer');
    const note = make('span', 'calloria-tryit-local-note', 'Fictional sample · no live account required');
    const next = make('button', 'calloria-tryit-next', 'Continue');
    next.type = 'button';
    next.disabled = true;
    task.options.forEach((option, index) => {
      const button = make('button', 'calloria-tryit-option', option.label);
      button.type = 'button';
      button.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const selected = task.options[index];
        if (selected.correct) activeScore += 1;
        Array.from(options.children).forEach((child, childIndex) => {
          child.disabled = true;
          child.dataset.correct = String(task.options[childIndex].correct);
        });
        feedback.textContent = selected.feedback;
        feedback.hidden = false;
        next.disabled = false;
        next.focus();
      });
      options.append(button);
    });
    next.addEventListener('click', () => {
      if (!answered) return;
      if (activeStep + 1 < demo.tasks.length) {
        activeStep += 1;
        renderStep();
      } else finishDemo();
    });
    footer.append(note, next);
    body.append(options, feedback, footer);
  };
  const finishDemo = () => {
    const demo = demos[activeId];
    const previous = memoryProgress[activeId] || { attempts: 0, bestScore: 0 };
    const bestScore = Math.max(previous.bestScore || 0, activeScore);
    memoryProgress[activeId] = {
      completed: true,
      attempts: Math.min(999, (previous.attempts || 0) + 1),
      bestScore,
      completedAt: new Date().toISOString()
    };
    writeProgress();
    body.replaceChildren();
    const result = make('section', 'calloria-tryit-result');
    result.append(make('div', 'calloria-tryit-eyebrow', 'PREVIEW COMPLETED'));
    result.append(make('div', 'calloria-tryit-score', activeScore + ' / ' + demo.tasks.length + ' correct'));
    const copy = activeScore === demo.tasks.length
      ? 'Strong result. You completed both sample decisions correctly.'
      : 'Preview completed. Review the explanations and try again to improve your score.';
    result.append(make('p', '', copy));
    result.append(make('p', '', 'This was a fictional learning sample, not a live product session. Nothing is sent or submitted from this preview. The official destination explains its current features and access options.'));
    const actions = make('div', 'calloria-tryit-result-actions');
    const open = make('a', '', 'Open ' + demo.name + ' ↗');
    open.href = demo.url;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    const ask = make('a', '', 'Ask about access / pricing');
    ask.href = demo.intentUrl;
    const again = make('button', '', 'Try the preview again');
    again.type = 'button';
    again.addEventListener('click', () => openDemo(activeId, lastTrigger));
    const done = make('button', '', 'Done');
    done.type = 'button';
    done.addEventListener('click', closeDialog);
    actions.append(open, ask, again, done);
    result.append(actions);
    body.append(result);
    close.focus();
  };
  function openDemo(id, trigger) {
    if (!demos[id]) return;
    activeId = id;
    activeStep = 0;
    activeScore = 0;
    lastTrigger = trigger || lastTrigger;
    title.textContent = demos[id].name;
    intro.textContent = demos[id].intro;
    renderStep();
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else dialog.setAttribute('open', '');
    const first = dialog.querySelector('.calloria-tryit-option');
    first?.focus();
  }
  root.addEventListener('click', event => {
    const preview = event.target.closest('[data-calloria-preview]');
    if (preview) {
      event.preventDefault();
      openDemo(preview.dataset.calloriaPreview, preview);
      return;
    }
    if (event.target.closest('[data-calloria-tryit-all]')) {
      root.querySelector('[data-calloria-goal="explore"]')?.click();
      root.querySelector('[data-calloria-discovery-results]')?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    if (event.target.closest('[data-calloria-goal]')) updateProgress();
  });
  readProgress();
  updateProgress();
})();
</script>`;

function replaceUnique(source, anchor, replacement) {
  const first = source.indexOf(anchor);
  if (first < 0 || source.indexOf(anchor, first + anchor.length) >= 0) return null;
  return source.slice(0, first) + replacement + source.slice(first + anchor.length);
}

export function transformCalloriaTryItStudioHtml(html) {
  if (typeof html !== 'string') throw new TypeError('Expected HTML source text.');
  if (!html.includes('id="calloria-discovery-guide"') || html.includes(HTML_MARKER)) return html;
  let out = replaceUnique(html, GOAL_ANCHOR, progressMarkup + '\n' + GOAL_ANCHOR);
  if (!out) return html;
  out = replaceUnique(out, CARD_ACTION_ANCHOR, `      const preview = element('button', 'calloria-discovery-preview-link', 'Try a quick preview');
      preview.type = 'button';
      preview.dataset.calloriaPreview = productId;
      preview.setAttribute('aria-label', 'Try a short sample preview for ' + product.name);
      actions.append(open, ask, request, help, preview);`);
  if (!out) return html;
  out = replaceUnique(out, '</head>', studioStyles + '\n</head>');
  if (!out) return html;
  out = replaceUnique(out, '</body>', studioScript + '\n</body>');
  if (!out) return html;
  const rootAnchor = '<section class="calloria-discovery" id="calloria-discovery-guide"';
  out = replaceUnique(out, rootAnchor, rootAnchor + ' ' + HTML_MARKER);
  return out || html;
}

export function calloriaTryItStudioPlugin() {
  return {
    name: 'calloria-try-it-studio-v6-58',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return transformCalloriaTryItStudioHtml(html);
      }
    }
  };
}
