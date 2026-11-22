const HTML_MARKER = 'CALLORIA_V699_OPERATIONS_CAPACITY_OUTLOOK';
const JS_MARKER = 'CALLORIA_V699_OPERATIONS_CAPACITY_OUTLOOK_RUNTIME';
const JS_ID = '/js/operations-intelligence-workbench.js';
const IMPORT_ANCHOR = "import { createClient } from '@supabase/supabase-js';";
const RENDER_ANCHOR = 'renderChannels(s.channels);renderDaily(s.daily);';
const REFRESH_ANCHOR = 'async function refresh(){';

const sectionMarkup = `
<!-- ${HTML_MARKER} -->
<section class="oi-section oi-capacity-section" aria-labelledby="oi-capacity-title">
  <article class="oi-panel">
    <div class="oi-section-head">
      <div><div class="oi-kicker">CAPACITY OUTLOOK · AGGREGATE ONLY</div><h2 id="oi-capacity-title">Backlog and demand forecast</h2></div>
      <span id="oi-capacity-status" class="oi-capacity-status" data-state="stable">Awaiting report</span>
    </div>
    <p class="oi-caption oi-capacity-intro">A directional seven-day outlook based on the latest recorded daily arrivals, resolutions and current active backlog.</p>
    <div id="oi-capacity-metrics" class="oi-capacity-metrics" aria-live="polite"><p class="oi-empty">Capacity outlook will appear when the aggregate report loads.</p></div>
    <div class="oi-capacity-projection-wrap">
      <div class="oi-capacity-subhead"><strong>Projected active backlog</strong><span>Assumes recent daily net movement continues</span></div>
      <div id="oi-capacity-projection" class="oi-capacity-projection"><p class="oi-empty">No projection available.</p></div>
    </div>
    <p id="oi-capacity-guidance" class="oi-footnote">Forecast is indicative only. It does not calculate agent headcount, change routing, or modify work records.</p>
  </article>
</section>
`;

const runtime = `
// ${JS_MARKER}
function renderCapacityOutlook(snapshot){
  const metricsHost=$('oi-capacity-metrics');
  const projectionHost=$('oi-capacity-projection');
  const statusHost=$('oi-capacity-status');
  const guidanceHost=$('oi-capacity-guidance');
  if(!metricsHost||!projectionHost||!statusHost)return;
  const outlook=buildCapacityOutlook(snapshot,{horizonDays:7});
  metricsHost.replaceChildren();projectionHost.replaceChildren();
  const makeNode=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=String(text);return node;};
  if(!outlook.ready){
    statusHost.textContent='Insufficient history';statusHost.dataset.state='watch';
    metricsHost.append(makeNode('p','oi-empty',outlook.reason));
    projectionHost.append(makeNode('p','oi-empty','Forecast will be available after at least three valid daily observations.'));
    if(guidanceHost)guidanceHost.textContent='No forecast is produced from insufficient history. The panel does not substitute missing observations with invented values.';
    return;
  }
  const count=value=>new Intl.NumberFormat('en-NG',{maximumFractionDigits:1}).format(value);
  const signed=value=>(value>0?'+':'')+count(value);
  const cards=[
    ['Average received / day',count(outlook.averageReceivedPerDay),'Latest seven recorded days'],
    ['Average resolved / day',count(outlook.averageResolvedPerDay),'Latest seven recorded days'],
    ['Net backlog movement / day',signed(outlook.netBacklogChangePerDay),outlook.netBacklogChangePerDay>0?'Backlog is growing':outlook.netBacklogChangePerDay<0?'Backlog is reducing':'No average movement'],
    ['Daily resolutions target',count(outlook.requiredResolutionsPerDay),'To clear current backlog within seven days']
  ];
  for(const [label,value,note] of cards){const card=makeNode('article','oi-capacity-metric');card.append(makeNode('span','',label),makeNode('strong','',value),makeNode('small','',note));metricsHost.append(card);}
  const statusLabels={clear:'Backlog clear',stable:'Backlog stable',recovering:'Backlog reducing',growing:'Backlog growing'};
  statusHost.textContent=statusLabels[outlook.status]||'Outlook available';statusHost.dataset.state=outlook.status;
  for(const item of outlook.projectedBacklog){
    const row=makeNode('div','oi-capacity-projection-row');
    row.append(makeNode('span','','Day '+item.day),makeNode('strong','',count(item.work)+' open items'));
    projectionHost.append(row);
  }
  const gap=outlook.dailyResolutionGap;
  let guidance='Recent recorded resolution throughput is broadly aligned with incoming demand.';
  if(gap>0.1)guidance='To clear the current backlog within seven days while absorbing typical new demand, the operation needs about '+count(gap)+' additional resolutions per day above its recent average.';
  else if(gap< -0.1)guidance='The recent resolution baseline is sufficient, on average, to absorb typical incoming demand and reduce the current backlog within the seven-day planning horizon.';
  if(outlook.demandTrendPercent!==null){guidance+=' Recent arrivals are '+Math.abs(outlook.demandTrendPercent)+'% '+(outlook.demandTrendPercent>=0?'higher':'lower')+' than the preceding seven-day period.';}
  if(guidanceHost)guidanceHost.textContent=guidance+' Forecast is directional, uses aggregate work-item counts, and does not calculate staffing headcount or change operational records.';
}
`;

export function calloriaOperationsCapacityOutlookPluginV699(){
  return {
    name:'calloria-operations-capacity-outlook-v6-99',
    enforce:'post',
    transform(code,id){
      const cleanId=String(id||'').split('?')[0].replaceAll('\\','/');
      if(!cleanId.endsWith(JS_ID))return null;
      if(code.includes(JS_MARKER))return null;
      const occurrences=(text,needle)=>text.split(needle).length-1;
      const required=[IMPORT_ANCHOR,RENDER_ANCHOR,REFRESH_ANCHOR];
      const missing=required.filter(anchor=>occurrences(code,anchor)!==1);
      if(missing.length){
        this.warn(`CALLORIA v6.99 skipped safely: Operations Intelligence workbench anchors changed (${missing.length} unmatched). Capacity outlook remains unavailable for this source version.`);
        return null;
      }
      let output=code.replace(IMPORT_ANCHOR,`${IMPORT_ANCHOR}\nimport { buildCapacityOutlook } from './operations-capacity-outlook-v6-99.js';`);
      output=output.replace(RENDER_ANCHOR,`${RENDER_ANCHOR}renderCapacityOutlook(s);`);
      output=output.replace(REFRESH_ANCHOR,`${runtime}\n${REFRESH_ANCHOR}`);
      return {code:output,map:null};
    },
    transformIndexHtml(html){
      if(html.includes(HTML_MARKER))return html;
      const headCount=html.split('</head>').length-1;
      const footerCount=html.split('<footer class="oi-footer">').length-1;
      if(headCount!==1||footerCount!==1){
        this.warn('CALLORIA v6.99 skipped HTML panel injection safely: Operations Intelligence HTML anchors changed.');
        return html;
      }
      const link='<link rel="stylesheet" href="/styles/operations-capacity-outlook-v6-99.css">';
      let output=html.replace('</head>',`${link}\n</head>`);
      output=output.replace('<footer class="oi-footer">',`${sectionMarkup}\n<footer class="oi-footer">`);
      return output;
    }
  };
}
