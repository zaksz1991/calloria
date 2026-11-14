const HTML_MARKER = 'data-calloria-discovery-guide="v6.56"';
const MAIN_MARKER = 'data-calloria-public-experience="v6.55"';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`[CALLORIA v6.56] Could not find ${label}. Install the cumulative v6.55 public-experience integration before v6.56.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`[CALLORIA v6.56] Found more than one ${label}. Refusing an ambiguous HTML transform.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

export const CALLORIA_DISCOVERY_PRODUCTS = Object.freeze({
  learn: Object.freeze({
    name: 'RuffNeck Learn (LMS)',
    url: 'https://ruffneck-lms.vercel.app/',
    summary: 'Learning and digital-skills destination.',
    firstStep: 'Open the official learning platform and explore the learning options shown there.'
  }),
  prospector: Object.freeze({
    name: 'RuffNeck Prospector',
    url: 'https://ruffneck-prospector.vercel.app/',
    summary: 'Prospecting and lead-focused tools for business development.',
    firstStep: 'Open Prospector and review its available prospecting workflow.'
  }),
  connect: Object.freeze({
    name: 'RuffNeck Connect',
    url: 'https://ruffneck-connect.vercel.app/',
    summary: 'Community and collaboration destination.',
    firstStep: 'Open Connect to see the available community and collaboration experience.'
  }),
  social: Object.freeze({
    name: 'RuffNeck Social Hub',
    url: 'https://ruffneck-social-hub.vercel.app/',
    summary: 'Social-media operations and multi-brand social workspace.',
    firstStep: 'Open Social Hub and inspect the social workspace and available tools.'
  }),
  kanoRun: Object.freeze({
    name: 'Kano Run / Kano Life',
    url: 'https://kano-run.vercel.app/',
    summary: 'Kano-based driving and life-simulation entertainment.',
    firstStep: 'Open Kano Run and choose an available play option.'
  }),
  kanoKeke: Object.freeze({
    name: 'Kano Keke',
    url: 'https://kano-keke.vercel.app/',
    summary: 'Keke life-simulation and entertainment experience.',
    firstStep: 'Open Kano Keke and explore its available game experience.'
  })
});

export const CALLORIA_DISCOVERY_GOALS = Object.freeze({
  play: Object.freeze({
    title: 'Start with entertainment',
    description: 'Try the two RuffNeck simulation games. No CALLORIA account is needed to explore the destinations.',
    products: Object.freeze(['kanoRun', 'kanoKeke'])
  }),
  learn: Object.freeze({
    title: 'Learn a skill or find guidance',
    description: 'Start with RuffNeck Learn for its learning platform, or ask CALLORIA for general practical guidance.',
    products: Object.freeze(['learn'])
  }),
  business: Object.freeze({
    title: 'Find prospects and grow a business',
    description: 'Compare the lead-focused Prospector destination with the Social Hub workspace.',
    products: Object.freeze(['prospector', 'social'])
  }),
  community: Object.freeze({
    title: 'Connect with communities',
    description: 'Start with the community and collaboration destination.',
    products: Object.freeze(['connect'])
  }),
  social: Object.freeze({
    title: 'Work with social media',
    description: 'Start with Social Hub for social-media operations and multi-brand work.',
    products: Object.freeze(['social'])
  }),
  explore: Object.freeze({
    title: 'Explore all RuffNeck destinations',
    description: 'Browse every current destination, then open the one that matches what you want to do.',
    products: Object.freeze(['learn', 'prospector', 'connect', 'social', 'kanoRun', 'kanoKeke'])
  })
});

const guideMarkup = `
<section class="calloria-discovery" id="calloria-discovery-guide" ${HTML_MARKER} aria-labelledby="calloria-discovery-title">
  <div class="calloria-discovery-heading">
    <div>
      <div class="calloria-discovery-kicker">RUFFNECK DISCOVERY GUIDE</div>
      <h2 id="calloria-discovery-title">Find the right place to start</h2>
      <p>Choose what you want to do. CALLORIA will point you to the most relevant official destination.</p>
    </div>
    <span class="calloria-discovery-step" aria-hidden="true">01 / 02</span>
  </div>
  <fieldset class="calloria-discovery-goals">
    <legend>What brings you here?</legend>
    <div class="calloria-discovery-goal-grid">
      <button type="button" data-calloria-goal="play" aria-pressed="false"><span aria-hidden="true">▶</span><strong>Play and be entertained</strong><small>Driving and life simulations</small></button>
      <button type="button" data-calloria-goal="learn" aria-pressed="false"><span aria-hidden="true">✦</span><strong>Learn and grow</strong><small>Learning and practical guidance</small></button>
      <button type="button" data-calloria-goal="business" aria-pressed="false"><span aria-hidden="true">↗</span><strong>Grow a business</strong><small>Prospects and social operations</small></button>
      <button type="button" data-calloria-goal="community" aria-pressed="false"><span aria-hidden="true">◎</span><strong>Connect with people</strong><small>Communities and collaboration</small></button>
      <button type="button" data-calloria-goal="social" aria-pressed="false"><span aria-hidden="true">▤</span><strong>Work with social media</strong><small>Social channels and brands</small></button>
      <button type="button" data-calloria-goal="explore" aria-pressed="false"><span aria-hidden="true">⌕</span><strong>Show me everything</strong><small>Browse all six destinations</small></button>
    </div>
  </fieldset>
  <section class="calloria-discovery-results" data-calloria-discovery-results hidden aria-live="polite" aria-label="Recommended RuffNeck destinations">
    <div class="calloria-discovery-result-heading"><div><span class="calloria-discovery-kicker">YOUR NEXT STEP</span><h3 data-calloria-result-title></h3><p data-calloria-result-description></p></div><button type="button" class="calloria-discovery-reset" data-calloria-discovery-reset>Change choice</button></div>
    <div class="calloria-discovery-product-grid" data-calloria-product-grid></div>
    <p class="calloria-discovery-boundary">Product access, registration, plans and payment are handled by the official product site. CALLORIA does not take payment or invent product prices.</p>
  </section>
  <div class="calloria-discovery-footer"><span>No sign-up. No contact details. Just a clearer next step.</span><a href="#learning-and-guidance">Ask CALLORIA before choosing</a></div>
</section>`;

const discoveryStyles = `
<style id="calloria-ruffneck-discovery-v656">
.calloria-discovery{margin:17px 0 15px;padding:15px;border:1px solid rgba(34,197,217,.23);border-radius:15px;background:linear-gradient(145deg,rgba(14,54,66,.48),rgba(5,18,29,.62));}
.calloria-discovery-heading,.calloria-discovery-result-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.calloria-discovery-kicker{color:#65d8d1;font:800 8px Manrope,sans-serif;letter-spacing:.15em}
.calloria-discovery-heading h2{margin:6px 0 5px;color:#edf8fb;font:800 19px/1.18 Manrope,sans-serif;letter-spacing:-.035em}
.calloria-discovery-heading p,.calloria-discovery-result-heading p{margin:0;color:#9bb6c4;font-size:10px;line-height:1.5}
.calloria-discovery-step{flex:0 0 auto;color:#7196a4;font:800 8px Manrope,sans-serif;letter-spacing:.1em}
.calloria-discovery-goals{min-width:0;margin:13px 0 0;padding:0;border:0}
.calloria-discovery-goals legend{margin-bottom:8px;color:#c4dce3;font-size:10px;font-weight:800}
.calloria-discovery-goal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
.calloria-discovery-goal-grid button{display:grid;grid-template-columns:22px minmax(0,1fr);align-items:center;column-gap:7px;min-width:0;min-height:57px;padding:8px;border:1px solid rgba(171,203,225,.16);border-radius:10px;background:rgba(255,255,255,.025);color:#eaf5f7;text-align:left;cursor:pointer;transition:border-color .15s,background .15s}
.calloria-discovery-goal-grid button>span{grid-row:span 2;display:grid;place-items:center;width:22px;height:22px;border-radius:7px;background:rgba(34,197,217,.12);color:#76e1e7;font:800 12px Manrope}
.calloria-discovery-goal-grid button strong{font:800 9px/1.3 Manrope,sans-serif}
.calloria-discovery-goal-grid button small{margin-top:2px;color:#8daab8;font:500 8px/1.35 "DM Sans",sans-serif}
.calloria-discovery-goal-grid button:hover,.calloria-discovery-goal-grid button:focus-visible{border-color:rgba(34,197,217,.62);outline:none}
.calloria-discovery-goal-grid button[aria-pressed="true"]{border-color:#47d5c8;background:rgba(34,197,217,.12);box-shadow:inset 0 0 0 1px rgba(34,197,217,.15)}
.calloria-discovery-results{margin-top:13px;padding-top:13px;border-top:1px solid rgba(171,203,225,.14)}
.calloria-discovery-results[hidden]{display:none}
.calloria-discovery-result-heading{align-items:center;margin-bottom:9px}
.calloria-discovery-result-heading h3{margin:4px 0 4px;color:#f0fbfd;font:800 14px Manrope,sans-serif}
.calloria-discovery-reset{flex:0 0 auto;border:1px solid rgba(171,203,225,.2);border-radius:7px;padding:7px 8px;background:rgba(255,255,255,.035);color:#bad2dc;font:700 8px "DM Sans",sans-serif;cursor:pointer}
.calloria-discovery-product-grid{display:grid;grid-template-columns:1fr;gap:7px}
.calloria-discovery-product{padding:10px;border:1px solid rgba(171,203,225,.14);border-radius:10px;background:rgba(1,11,19,.34)}
.calloria-discovery-product strong{display:block;color:#eaf8fa;font:800 10px Manrope,sans-serif}
.calloria-discovery-product p{margin:5px 0 0;color:#9cb5c1;font-size:9px;line-height:1.45}
.calloria-discovery-product-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
.calloria-discovery-product-actions a,.calloria-discovery-product-actions button{display:inline-flex;align-items:center;justify-content:center;min-height:30px;border:1px solid rgba(34,197,217,.32);border-radius:7px;padding:6px 8px;background:rgba(34,197,217,.08);color:#bdf4f3;font:800 8px Manrope,sans-serif;text-decoration:none;cursor:pointer}
.calloria-discovery-product-actions a{background:linear-gradient(100deg,#20bfd1,#36d4bd);color:#04202a;border:0}
.calloria-discovery-product-actions a:hover,.calloria-discovery-product-actions button:hover{filter:brightness(1.1)}
.calloria-discovery-boundary{margin:9px 0 0;color:#7894a3;font-size:8px;line-height:1.5}
.calloria-discovery-footer{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px;padding-top:10px;border-top:1px solid rgba(171,203,225,.12);color:#829eac;font-size:8px;line-height:1.45}
.calloria-discovery-footer a{color:#74dedc;font-weight:800;text-decoration:underline;text-underline-offset:2px}
.calloria-discovery button:focus-visible,.calloria-discovery a:focus-visible{outline:2px solid #79e6df;outline-offset:2px}
@media(max-width:740px){.calloria-discovery{margin:13px 0;padding:12px}.calloria-discovery-heading h2{font-size:17px}.calloria-discovery-goal-grid{grid-template-columns:1fr 1fr;gap:6px}.calloria-discovery-goal-grid button{min-height:56px;padding:7px}.calloria-discovery-goal-grid button strong{font-size:8px}.calloria-discovery-goal-grid button small{font-size:7px}.calloria-discovery-footer{font-size:7px}}
@media(max-width:360px){.calloria-discovery-goal-grid{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.calloria-discovery-goal-grid button{transition:none}}
</style>`;

const discoveryScript = `
<script id="calloria-discovery-guide-script-v656">
(() => {
  const root = document.getElementById('calloria-discovery-guide');
  if (!root || root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';
  const products = ${JSON.stringify(CALLORIA_DISCOVERY_PRODUCTS)};
  const goals = ${JSON.stringify(CALLORIA_DISCOVERY_GOALS)};
  const results = root.querySelector('[data-calloria-discovery-results]');
  const title = root.querySelector('[data-calloria-result-title]');
  const description = root.querySelector('[data-calloria-result-description]');
  const grid = root.querySelector('[data-calloria-product-grid]');
  const questionInput = document.querySelector('#question');
  const askPrompt = product => 'Help me understand what ' + product.name + ' is for, who it is suitable for and the first practical step to get started. Use verified information only. Do not guess prices, account access, plans or availability.';
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const renderGoal = key => {
    const goal = goals[key];
    if (!goal) return;
    root.querySelectorAll('[data-calloria-goal]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.calloriaGoal === key)));
    title.textContent = goal.title;
    description.textContent = goal.description;
    grid.replaceChildren();
    goal.products.forEach(productId => {
      const product = products[productId];
      if (!product) return;
      const card = element('article', 'calloria-discovery-product');
      card.append(element('strong', '', product.name));
      card.append(element('p', '', product.summary));
      card.append(element('p', '', product.firstStep));
      const actions = element('div', 'calloria-discovery-product-actions');
      const open = element('a', '', 'Open official destination ↗');
      open.href = product.url;
      open.target = '_blank';
      open.rel = 'noopener noreferrer';
      open.setAttribute('aria-label', 'Open ' + product.name + ' in a new tab');
      const ask = element('button', '', 'Ask before I start');
      ask.type = 'button';
      ask.dataset.calloriaAskAbout = productId;
      actions.append(open, ask);
      card.append(actions);
      grid.append(card);
    });
    results.hidden = false;
    results.scrollIntoView?.({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  };
  root.addEventListener('click', event => {
    const choice = event.target.closest('[data-calloria-goal]');
    if (choice) { renderGoal(choice.dataset.calloriaGoal); return; }
    const ask = event.target.closest('[data-calloria-ask-about]');
    if (ask) {
      const product = products[ask.dataset.calloriaAskAbout];
      if (!product || !questionInput) return;
      questionInput.value = askPrompt(product);
      questionInput.focus();
      questionInput.scrollIntoView?.({ behavior: 'auto', block: 'center' });
      return;
    }
    if (event.target.closest('[data-calloria-discovery-reset]')) {
      results.hidden = true;
      grid.replaceChildren();
      root.querySelectorAll('[data-calloria-goal]').forEach(button => button.setAttribute('aria-pressed', 'false'));
      root.querySelector('[data-calloria-goal="play"]')?.focus();
    }
  });
})();
</script>`;

export function transformCalloriaRuffNeckDiscoveryHtml(html) {
  if (typeof html !== 'string') throw new TypeError('Expected HTML source text.');

  // Route the launch-screen product CTA to the new guided chooser, not a raw product list.
  if (html.includes(MAIN_MARKER)) {
    const directProductsHref = 'href="/customer-care.html#ruffneck-platforms"';
    if (html.includes('href="/customer-care.html#calloria-discovery-guide"')) return html;
    return replaceOnce(
      html,
      directProductsHref,
      'href="/customer-care.html#calloria-discovery-guide"',
      'public landing-page Discover RuffNeck route'
    );
  }

  if (!html.includes('id="ruffneck-platforms"') || !html.includes('class="platform-list"')) return html;
  if (html.includes(HTML_MARKER)) return html;
  let out = replaceOnce(
    html,
    '<div class="platform-list" id="ruffneck-platforms"',
    `${guideMarkup}\n<div class="platform-list" id="ruffneck-platforms"`,
    'v6.55 RuffNeck platform directory'
  );
  out = replaceOnce(out, '</head>', `${discoveryStyles}\n</head>`, 'customer-care document head');
  out = replaceOnce(out, '</body>', `${discoveryScript}\n</body>`, 'customer-care document body');
  return out;
}

export function calloriaRuffNeckDiscoveryGuidePlugin() {
  return {
    name: 'calloria-ruffneck-discovery-guide-v6-56',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return transformCalloriaRuffNeckDiscoveryHtml(html);
      }
    }
  };
}
