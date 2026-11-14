const MAIN_MARKER = 'data-calloria-public-experience="v6.55"';
const CARE_MARKER = 'data-calloria-customer-pathways="v6.55"';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`[CALLORIA v6.55] Could not find ${label} in current HTML. No partial transform was applied.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`[CALLORIA v6.55] Found more than one ${label} anchor. Refusing an ambiguous HTML transform.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const experienceStyles = `
<style id="calloria-public-experience-v655">
  .calloria-pathways{width:min(620px,100%);margin:16px 0 0;pointer-events:auto}
  .calloria-pathways-heading{margin:0 0 8px;color:#9bbdc0;font:800 8px Manrope,sans-serif;letter-spacing:1.25px}
  .calloria-pathways-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .calloria-pathway{display:grid;grid-template-columns:30px minmax(0,1fr) 16px;align-items:center;gap:9px;min-height:58px;padding:9px 11px;border:1px solid rgba(192,226,226,.2);border-radius:9px;background:rgba(5,20,31,.72);color:#edf8f5;text-decoration:none;backdrop-filter:blur(10px);transition:transform .16s,border-color .16s,background .16s}
  .calloria-pathway:hover,.calloria-pathway:focus-visible{transform:translateY(-2px);border-color:rgba(115,231,205,.65);background:rgba(12,48,53,.84);outline:none}
  .calloria-pathway-icon{width:30px;height:30px;display:grid;place-items:center;border-radius:8px;background:rgba(77,207,180,.13);color:#8cebd4;font:900 12px Manrope}
  .calloria-pathway-copy{display:grid;gap:3px;min-width:0}
  .calloria-pathway-copy strong{font:800 10px Manrope;color:#f4fbf8}
  .calloria-pathway-copy small{font:500 8px/1.45 "DM Sans",sans-serif;color:#b4cbd0}
  .calloria-pathway-arrow{color:#8ee8d3;font-size:13px}
  .calloria-guest-reassurance{display:block;margin-top:8px;color:#94afb7;font:500 8px/1.5 "DM Sans",sans-serif}
  .game-launch-account .calloria-account-help{border-color:rgba(123,225,205,.42);color:#b9f1e2}
  .immersive-guide-link{display:inline-flex;align-items:center;justify-content:center;min-height:34px;margin-right:8px;padding:0 11px;border:1px solid rgba(123,225,205,.34);border-radius:7px;background:rgba(6,31,39,.72);color:#baf3e3;text-decoration:none;font:800 8px Manrope;letter-spacing:.65px;pointer-events:auto}
  .immersive-guide-link:hover,.immersive-guide-link:focus-visible{border-color:#7be1c9;background:rgba(14,61,62,.9);outline:none}
  .sidebar .support-card{display:flex!important;align-items:center;gap:9px;margin:12px 7px 10px;padding:10px 8px;border:1px solid rgba(116,219,195,.2);border-radius:9px;background:rgba(38,151,130,.09);text-decoration:none!important}
  .sidebar .support-card strong{display:block;color:#e8f8f3;font:800 9px Manrope}
  .sidebar .support-card small{display:block;margin-top:3px;color:#91b7b8;font:500 7px/1.35 "DM Sans",sans-serif}
  .sidebar .support-card .support-icon{display:grid;place-items:center;width:24px;height:24px;flex:0 0 24px;border-radius:7px;background:rgba(65,206,174,.16);color:#9beed9}
  .sidebar .support-card>span:last-child{margin-left:auto;color:#8de7d0}
  .care-header .care-path-links{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .care-header .care-path-links a{color:#b9eee1;text-decoration:none;font-size:11px;font-weight:700}
  .care-header .care-path-links a:hover{text-decoration:underline}
  .care-journey-note{margin:14px 0 0;padding:12px 14px;border:1px solid rgba(74,195,166,.22);border-radius:10px;background:rgba(31,141,118,.08);color:#c7e4dc;font-size:11px;line-height:1.55}
  .care-journey-note strong{display:block;margin-bottom:3px;color:#e6fbf4}
  @media(max-width:760px){
    .calloria-pathways{margin-top:12px}
    .calloria-pathways-grid{grid-template-columns:1fr;gap:6px}
    .calloria-pathway{min-height:48px;padding:7px 9px}
    .calloria-pathway-copy strong{font-size:9px}
    .calloria-pathway-copy small{font-size:7px}
    .calloria-guest-reassurance{font-size:7px}
    .immersive-guide-link{min-height:31px;margin-right:5px;padding:0 8px;font-size:7px}
  }
  @media(max-height:760px) and (min-width:761px){
    .calloria-pathways{margin-top:8px}
    .calloria-pathway{min-height:49px;padding:7px 9px}
    .game-launch-copy h1{margin-top:12px;margin-bottom:8px}
    .game-launch-actions{margin-top:15px}
  }
  @media(prefers-reduced-motion:reduce){.calloria-pathway{transition:none}.calloria-pathway:hover{transform:none}}
</style>`;

export function transformCalloriaPublicExperienceHtml(html, page = '/index.html') {
  if (typeof html !== 'string') throw new TypeError('Expected HTML source text.');

  if (html.includes('id="gameLaunchScreen"')) {
    if (html.includes(MAIN_MARKER)) return html;

    let out = html;
    out = replaceOnce(
      out,
      '<small>THE CONTACT CENTRE CAREER SIMULATOR</small>',
      '<small>PLAY · LEARN · DISCOVER</small>',
      'game brand tagline'
    );
    out = replaceOnce(
      out,
      '<button type="button" class="game-account-button" data-cloud-open-account>OPTIONAL ACCOUNT</button>',
      '<button type="button" class="game-account-button calloria-account-help" data-cloud-open-account title="Optional: create an account only when you want cloud-saved progress">SAVE PROGRESS · OPTIONAL</button>',
      'optional account action'
    );
    out = replaceOnce(
      out,
      '<h1>Step inside.<br><em>Build your career.</em></h1>',
      '<h1>Play for fun.<br><em>Leave with something useful.</em></h1>',
      'public-facing launch headline'
    );
    out = replaceOnce(
      out,
      '<p>Explore a working contact centre, learn the role, serve customers and progress from new recruit to operations leader.</p>',
      '<p>Explore a living 3D world, try realistic everyday challenges, pick up useful customer and communication skills, and discover RuffNeck products when they fit what you need.</p>',
      'public-facing launch description'
    );
    out = replaceOnce(
      out,
      '<button id="launchDeskButton" class="game-secondary-button" type="button">OPERATIONS DESK</button>',
      '<button id="launchDeskButton" class="game-secondary-button" type="button" title="Open the lighter, non-3D experience">LIGHTWEIGHT MODE</button>',
      'lightweight-mode action'
    );
    const guestNote = '<small class="guest-save-note">No registration required. Guest progress stays on this device. Anonymous play statistics use a random browser ID.</small>';
    const pathways = `${guestNote}
            <nav class="calloria-pathways" ${MAIN_MARKER} aria-label="Choose what you want from CALLORIA">
              <p class="calloria-pathways-heading">CHOOSE WHAT YOU WANT TO DO NEXT</p>
              <div class="calloria-pathways-grid">
                <a class="calloria-pathway" href="/customer-care.html#learning-and-guidance" aria-label="Learn and get practical guidance">
                  <span class="calloria-pathway-icon" aria-hidden="true">✦</span><span class="calloria-pathway-copy"><strong>Learn &amp; get guidance</strong><small>Explore practical topics, product help and answers.</small></span><b class="calloria-pathway-arrow" aria-hidden="true">↗</b>
                </a>
                <a class="calloria-pathway" href="/customer-care.html#ruffneck-platforms" aria-label="Discover RuffNeck products and services">
                  <span class="calloria-pathway-icon" aria-hidden="true">◆</span><span class="calloria-pathway-copy"><strong>Discover RuffNeck</strong><small>Compare destinations and open the product that interests you.</small></span><b class="calloria-pathway-arrow" aria-hidden="true">↗</b>
                </a>
                <a class="calloria-pathway" href="/customer-care.html#ready-to-start" aria-label="Ask about getting started with a RuffNeck product or service">
                  <span class="calloria-pathway-icon" aria-hidden="true">₦</span><span class="calloria-pathway-copy"><strong>Ready to enquire?</strong><small>Ask about services, access, plans or a quotation.</small></span><b class="calloria-pathway-arrow" aria-hidden="true">↗</b>
                </a>
              </div>
              <small class="calloria-guest-reassurance">Start as a guest. An account is optional and only needed for features that explicitly require one.</small>
            </nav>`;
    out = replaceOnce(out, guestNote, pathways, 'guest-access note');
    out = replaceOnce(
      out,
      '<button id="exitFloorButton" class="immersive-exit" type="button">EXIT GAME <span>Esc</span></button>',
      '<a class="immersive-guide-link" href="/customer-care.html" target="_blank" rel="noopener noreferrer" aria-label="Open CALLORIA learning, customer care and RuffNeck products in a new tab">GUIDES &amp; PRODUCTS ↗</a><button id="exitFloorButton" class="immersive-exit" type="button">EXIT GAME <span>Esc</span></button>',
      'immersive customer pathway link'
    );
    out = replaceOnce(out, '</head>', `${experienceStyles}\n</head>`, 'document head insertion point');
    return out;
  }

  if (html.includes('class="platform-list"')) {
    if (html.includes(CARE_MARKER)) return html;
    let out = html;
    out = replaceOnce(out, '<div class="platform-list">', `<div class="platform-list" id="ruffneck-platforms" ${CARE_MARKER} aria-label="RuffNeck products and services">`, 'RuffNeck product directory');
    out = replaceOnce(out, '<div class="topic-grid" aria-label="Common enquiry areas">', '<div class="topic-grid" id="learning-and-guidance" aria-label="Common enquiry areas">', 'learning and guidance topics');
    out = replaceOnce(out, '<button type="button" class="topic-chip" data-prompt="What services does RuffNeck offer, and how can I enquire about them?">Services & quotations</button>', '<button type="button" class="topic-chip" id="services-and-quotations" data-prompt="I need information about RuffNeck services, access, plans or an official quotation. Help me identify the correct next step without guessing prices or availability.">Services & quotations</button><button type="button" class="topic-chip" id="ready-to-start" data-prompt="I am ready to get started with a RuffNeck product or service. Help me confirm the official product route, access requirements and any published plan or quotation details. Do not guess prices or availability.">Ready to get started</button>', 'services and quotations topic');
    out = replaceOnce(out, '<h1>Every RuffNeck product. One point of support.</h1>', '<h1>Explore, learn and get help with RuffNeck.</h1>', 'customer care public headline');
    out = replaceOnce(out, '<a href="/case-desk">Staff Case Desk</a>', '<a href="/case-desk" aria-label="Restricted staff sign-in">Staff sign-in</a>', 'restricted staff navigation label');
    out = replaceOnce(out, '<h2>How can we assist?</h2>', '<h2>What would you like to do?</h2>', 'customer care prompt headline');
    out = replaceOnce(out, '<p class="muted">Ask about a RuffNeck platform, service, complaint or personal-development topic.</p>', '<p class="muted">Ask a question, learn something useful, compare our platforms or request information before you commit.</p>', 'customer care journey description');
    out = replaceOnce(out, '<div class="privacy-note"><strong>Guest access</strong>', '<div class="care-journey-note"><strong>Browse first. Decide when ready.</strong>Open a product directly to explore it, or ask CALLORIA to help you understand which service fits your need. Product access, plans and payment are handled by the owning RuffNeck platform.</div>\n        <div class="privacy-note"><strong>Guest access</strong>', 'customer purchase-boundary note');
    out = replaceOnce(out, '</head>', `${experienceStyles}\n</head>`, 'customer care head insertion point');
    return out;
  }

  return html;
}

export function calloriaPublicExperienceHubPlugin() {
  return {
    name: 'calloria-public-experience-hub-v6-55',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        return transformCalloriaPublicExperienceHtml(html, context?.path || '/index.html');
      }
    }
  };
}
