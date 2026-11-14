// v6.51 anchors copied from the current public main.js/workforce-engine.js shape.
const initialState = () => ({
  applicantName: '',
  selectedTrack: 'banking',
  roleTitle: 'Customer Experience Associate',
  department: 'Banking Operations',
});
function loadState() {
  const parsed = JSON.parse(localStorage.getItem('x') || '{}');
  const migrated = { ...initialState(), ...parsed };
  return migrated;
}
function escapeHTML(value) { return String(value ?? ''); }
let state = {platformTrainingRecords:[],systemEvents:[],interactionTimeline:[],activePlatformId:''};
const SYSTEMS = [{"id": "icc", "name": "ICC", "purpose": "Interaction control, queue events and customer satisfaction"}, {"id": "crm", "name": "CRM", "purpose": "Customer profile, interaction history and cases"}, {"id": "firstmobile", "name": "FirstMobile", "purpose": "Optional banking-industry digital banking support scenarios"}, {"id": "ussd", "name": "USSD", "purpose": "Optional banking-industry short-code support scenarios"}, {"id": "postilion", "name": "Postilion", "purpose": "Optional card and payment-switching investigation scenarios"}, {"id": "jira", "name": "JIRA", "purpose": "Technical incidents and service requests"}, {"id": "fcqa", "name": "FCQA", "purpose": "Quality evaluation and interaction review"}, {"id": "ruffneck-lms", "name": "RuffNeck LMS", "purpose": "Learning content, learner access, course progress and training support"}, {"id": "ruffneck-prospector", "name": "RuffNeck Prospector", "purpose": "Prospect research, lead discovery, qualification and follow-up"}, {"id": "ruffneck-connect", "name": "RuffNeck Connect", "purpose": "Messaging, communication workflows and delivery support"}, {"id": "ruffneck-social-hub", "name": "RuffNeck Social Hub", "purpose": "Social account connections, publishing, campaigns and analytics support"}, {"id": "kano-run", "name": "Kano Run", "purpose": "Player access, gameplay controls, progress and game-session support"}, {"id": "kano-keke", "name": "Kano Keke", "purpose": "Keke-driving gameplay, control configuration and player-session support"}];
let viewRoot={innerHTML:''};
function pushOperationEvent(){} function saveState(){} function renderView(){} function toast(){}
function renderWorkforce() {
  viewRoot.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Enterprise systems sandbox</h3><p>Connected workflow practice using synthetic records only. No real banking systems or transactions.</p></div><span class="pill green">SIMULATION</span></div>
         <div class="grid three">${SYSTEMS.map(s=>`<article class="campaign-card"><span class="subtle-label">${s.id.toUpperCase()}</span><h3>${escapeHTML(s.name)}</h3><p>${escapeHTML(s.purpose)}</p><button class="btn outline small" data-action="launch-system" data-system="${s.id}">Open simulated system</button></article>`).join('')}</div>
         <h4 style="margin-top:16px">System activity</h4>
         ${state.systemEvents.slice(-8).reverse().map(e=>`<div class="data-row">${e.systemId}</div>`).join('')}
         </section>`;
}
function handleAction(action,event){switch(action){case 'launch-system': {
       const system=SYSTEMS.find(x=>x.id===event.system);
       if(!system)break;
       const reference=`SIM-${system.id.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
       state.systemEvents.push({systemId:system.id,action:'Opened synthetic workflow'});saveState();renderView();break;
     }}}
document.addEventListener('click',e=>{
  const template=e.target.closest('[data-digital-template]');if(template){return;}
});

function renderCRM(){
  viewRoot.innerHTML = `<table><tbody><tr><td>${c.reference}</td><td>${c.qa}%</td></tr></tbody></table><div><p><strong>Issue:</strong> ${escapeHTML(c.title)}</p><p><strong>Disposition:</strong> ${escapeHTML(c.status)}</p></div>`;
}
document.addEventListener('submit',async e=>{
  if(e.target.id==='existingForm'){e.preventDefault();}
});
function initClock(){}
