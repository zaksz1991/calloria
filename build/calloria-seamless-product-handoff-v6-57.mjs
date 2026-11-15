import { transformCalloriaRuffNeckDiscoveryHtml } from './calloria-ruffneck-discovery-guide-v6-56.mjs';

const HTML_MARKER = 'data-calloria-seamless-handoff="v6.57"';
const SCRIPT_MARKER = 'CALLORIA v6.57 support-router prefill bridge';
const MODULE_SUFFIX = '/js/support-router-workbench.js';

const SUPPORT_PLATFORM_IDS = Object.freeze({
  learn: 'ruffneck-learn',
  prospector: 'ruffneck-prospector',
  connect: 'ruffneck-connect',
  social: 'ruffneck-social-hub',
  kanoRun: 'kano-run',
  kanoKeke: 'kano-keke'
});

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`[CALLORIA v6.57] Could not find ${label}. Keep v6.56 registered before v6.57 and use the cumulative Vite configuration.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`[CALLORIA v6.57] Found more than one ${label}. Refusing an ambiguous transformation.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const cardHandoffStyles = `
<style id="calloria-seamless-product-handoff-v657">
.calloria-discovery-product-actions a.calloria-discovery-support-link{background:rgba(34,197,217,.08);border:1px solid rgba(34,197,217,.32);color:#bdf4f3}
.calloria-discovery-product-actions a.calloria-discovery-support-link:hover,.calloria-discovery-product-actions a.calloria-discovery-support-link:focus-visible{border-color:#79e6df;background:rgba(34,197,217,.15);filter:none;outline:2px solid #79e6df;outline-offset:2px}
.calloria-discovery-handoff-note{margin:8px 0 0;color:#8caab7;font:500 8px/1.5 "DM Sans",sans-serif}
@media(max-width:740px){.calloria-discovery-product-actions a{flex:1 1 130px;min-width:0}.calloria-discovery-product-actions{gap:5px}}
</style>`;

const cardHandoffScript = `
<script id="calloria-seamless-product-handoff-script-v657">
(() => {
  const root = document.getElementById('calloria-discovery-guide');
  if (!root || root.dataset.handoffInitialized === 'true') return;
  root.dataset.handoffInitialized = 'true';
  const platformIds = ${JSON.stringify(SUPPORT_PLATFORM_IDS)};
  const handoffUrl = (productId, intent) => '/support-router.html?platform=' + encodeURIComponent(platformIds[productId]) + '&intent=' + encodeURIComponent(intent);
  root.addEventListener('click', event => {
    const action = event.target.closest('[data-calloria-handoff]');
    if (!action) return;
    const productId = action.dataset.productId;
    const intent = action.dataset.calloriaHandoff;
    if (!Object.hasOwn(platformIds, productId) || !['sales_enquiry', 'platform_support'].includes(intent)) {
      event.preventDefault();
      return;
    }
    action.href = handoffUrl(productId, intent);
  });
})();
</script>`;

const cardAnchor = `      const ask = element('button', '', 'Ask before I start');
      ask.type = 'button';
      ask.dataset.calloriaAskAbout = productId;
      actions.append(open, ask);
      card.append(actions);`;

const cardReplacement = `      const ask = element('button', '', 'Ask CALLORIA');
      ask.type = 'button';
      ask.dataset.calloriaAskAbout = productId;
      const request = element('a', 'calloria-discovery-support-link', 'Access / pricing');
      request.href = '/support-router.html?platform=' + encodeURIComponent(${JSON.stringify(SUPPORT_PLATFORM_IDS)}[productId]) + '&intent=sales_enquiry';
      request.dataset.calloriaHandoff = 'sales_enquiry';
      request.dataset.productId = productId;
      request.setAttribute('aria-label', 'Ask about access or pricing for ' + product.name);
      const help = element('a', 'calloria-discovery-support-link', 'Product support');
      help.href = '/support-router.html?platform=' + encodeURIComponent(${JSON.stringify(SUPPORT_PLATFORM_IDS)}[productId]) + '&intent=platform_support';
      help.dataset.calloriaHandoff = 'platform_support';
      help.dataset.productId = productId;
      help.setAttribute('aria-label', 'Get product support for ' + product.name);
      actions.append(open, ask, request, help);
      card.append(actions);`;

const handoffNoteAnchor = 'Product access, registration, plans and payment are handled by the official product site. CALLORIA does not take payment or invent product prices.';
const handoffNoteReplacement = 'Product access, registration, plans and payment are handled by the official product site. CALLORIA does not take payment or invent product prices. Access / pricing and Product support open a prefilled request for you to review; nothing is submitted automatically.';

export function transformCalloriaSeamlessProductHandoffHtml(html) {
  if (typeof html !== 'string') throw new TypeError('Expected HTML source text.');
  if (!html.includes('id="calloria-discovery-guide"')) return html;
  if (html.includes(HTML_MARKER)) return html;

  // Bring the v6.56 public discovery cards to the actual human support-routing workflow.
  let out = replaceOnce(html, cardAnchor, cardReplacement, 'v6.56 product-card action block');
  out = replaceOnce(out, handoffNoteAnchor, handoffNoteReplacement, 'v6.56 product purchase-boundary note');
  out = replaceOnce(out, '</head>', `${cardHandoffStyles}\n</head>`, 'Customer Care document head');
  out = replaceOnce(out, '</body>', `${cardHandoffScript}\n</body>`, 'Customer Care document body');
  return out.replace('<section class="calloria-discovery" id="calloria-discovery-guide"', `<section class="calloria-discovery" id="calloria-discovery-guide" ${HTML_MARKER}`);
}

const PREFILL_BRIDGE = `
/* ${SCRIPT_MARKER} */
(() => {
  const params = new URLSearchParams(window.location.search);
  const platformId = params.get('platform') || '';
  const intent = params.get('intent') || '';
  const product = PLATFORMS.find(item => item.id === platformId);
  if (!product) return;

  selectedPlatform = product.id;
  renderPlatforms();
  renderSelectedHelp();

  const supportedIntents = new Set(['sales_enquiry', 'platform_support', 'account_access', 'technical_support']);
  if (!supportedIntents.has(intent)) return;
  const intentSelect = $('#intent');
  const subjectInput = $('#subject');
  const summaryInput = $('#summary');
  if (!intentSelect || !subjectInput || !summaryInput) return;

  const templates = {
    sales_enquiry: {
      subject: product.name + ' access and pricing enquiry',
      summary: 'I am interested in ' + product.name + '. Please explain the current official way to get started, any published access or pricing information, and the next step. Please distinguish confirmed details from anything that needs checking.'
    },
    platform_support: {
      subject: product.name + ' product support',
      summary: 'I need help with ' + product.name + '. Please guide me through the approved self-service steps or route this request to the appropriate support team. I will provide only the non-sensitive details needed.'
    },
    account_access: {
      subject: product.name + ' account access help',
      summary: 'I need help accessing ' + product.name + '. Please explain the approved account recovery or sign-in steps. Do not ask me to share a password, PIN, OTP or recovery code.'
    },
    technical_support: {
      subject: product.name + ' technical support',
      summary: 'I have a technical problem with ' + product.name + '. Please help identify the correct troubleshooting steps or support route. I will provide a non-sensitive description of the issue.'
    }
  };
  intentSelect.value = intent;
  subjectInput.value = templates[intent].subject.slice(0, 140);
  summaryInput.value = templates[intent].summary.slice(0, 600);
  const status = $('#submit-status');
  if (status) {
    status.textContent = 'We selected ' + product.name + ' and prepared a ' + (intent === 'sales_enquiry' ? 'product information request' : 'support request') + '. Review and edit the details. Nothing is submitted until you give consent and press Submit.';
    status.className = 'status';
  }
})();`;

export function transformCalloriaSupportRouterWorkbench(code, id = '') {
  if (typeof code !== 'string') throw new TypeError('Expected JavaScript source text.');
  const normalizedId = String(id).split('?')[0].replace(/\\/g, '/');
  if (!normalizedId.endsWith(MODULE_SUFFIX)) return null;
  if (code.includes(SCRIPT_MARKER)) return code;
  const anchor = 'renderPlatforms(); renderSelectedHelp();';
  const insertion = code.lastIndexOf(anchor);
  if (insertion < 0) throw new Error('[CALLORIA v6.57] Could not find the final support-router initial render call. The current support-router workbench source may have changed.');
  return code.slice(0, insertion) + anchor + `\n${PREFILL_BRIDGE}` + code.slice(insertion + anchor.length);
}

export function calloriaSeamlessProductHandoffPlugin() {
  return {
    name: 'calloria-seamless-product-handoff-v6-57',
    enforce: 'post',
    transform(code, id) {
      return transformCalloriaSupportRouterWorkbench(code, id);
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return transformCalloriaSeamlessProductHandoffHtml(html);
      }
    }
  };
}

export { SUPPORT_PLATFORM_IDS };
