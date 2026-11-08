/**
 * CALLORIA GLB asset catalogue.
 * URLs are public-root URLs. Vite copies public/assets to dist/assets.
 */
export const GLB_ASSET_BASE = '/assets/models/';

const entries = [
  { id: 'headset-model', name: 'Headset model', category: 'Accessories', group: 'Headsets', role: 'Headset / audio equipment', path: 'accessories/headsets/model.glb', priority: 2 },

  { id: 'archeologist-girl', name: 'Archeologist girl', category: 'Characters', group: 'Agents', role: 'Agent candidate; appearance review required', path: 'characters/agents/archeologist_girl.glb', priority: 3 },
  { id: 'female-agent', name: 'Female agent', category: 'Characters', group: 'Agents', role: 'Primary female agent candidate', path: 'characters/agents/female-agent.glb', priority: 1 },
  { id: 'gp5-woman', name: 'GP5 woman', category: 'Characters', group: 'Agents', role: 'Agent candidate; appearance review required', path: 'characters/agents/gp5woman.glb', priority: 2 },
  { id: 'male-agent', name: 'Male agent', category: 'Characters', group: 'Agents', role: 'Primary male agent candidate', path: 'characters/agents/male-agent.glb', priority: 1 },
  { id: 'mr-r', name: 'Mr R', category: 'Characters', group: 'Agents', role: 'Agent candidate; appearance review required', path: 'characters/agents/mr-r.glb', priority: 2 },
  { id: 'office-lady-character', name: 'Office lady character', category: 'Characters', group: 'Agents', role: 'Agent candidate; appearance review required', path: 'characters/agents/office_lady_character.glb', priority: 2 },

  { id: 'ribbert-customer', name: 'Ribbert', category: 'Characters', group: 'Customers', role: 'Customer character; visual suitability review required', path: 'characters/customers/ribbert.glb', priority: 4 },
  { id: 'sleazy-alien-manager', name: 'Sleazy alien manager', category: 'Characters', group: 'Managers', role: 'Non-standard / stylised manager; do not use as standard staff', path: 'characters/managers/sleazy_alien_manager.glb', priority: 5 },
  { id: 'lady-trenchcoat', name: 'Lady in a trenchcoat', category: 'Characters', group: 'Receptionists', role: 'Receptionist candidate; attire review required', path: 'characters/receptionists/lady_in_a_trenchcoat.glb', priority: 3 },
  { id: 'office-female-supervisor', name: 'Office female', category: 'Characters', group: 'Supervisors', role: 'Supervisor candidate', path: 'characters/supervisors/office_female.glb', priority: 3 },
  { id: 'bad-supervisor', name: 'The bad supervisor', category: 'Characters', group: 'Supervisors', role: 'Supervisor candidate; visual suitability review required', path: 'characters/supervisors/the_bad_supervisor.glb', priority: 5 },
  { id: 'robbert-visitor', name: 'Robbert', category: 'Characters', group: 'Visitors', role: 'Visitor character; visual suitability review required', path: 'characters/visitors/robbert.glb', priority: 4 },

  { id: 'office-desk', name: 'Office desk', category: 'Office', group: 'Desks', role: 'Agent workstation furniture', path: 'office/desks/office_desk.glb', priority: 2 },
  { id: 'office-computer', name: 'Office computer', category: 'Office', group: 'Equipment', role: 'Workstation computer', path: 'office/equipment/office_computer.glb', priority: 2 },
  { id: 'reception-desk', name: 'Reception desk', category: 'Office', group: 'Reception', role: 'Reception furniture', path: 'office/reception/reception-desk.glb', priority: 2 }
];

export const GLB_ASSET_REGISTRY = Object.freeze(entries.map((entry) => Object.freeze({
  ...entry,
  url: `${GLB_ASSET_BASE}${entry.path}`
})));

export function getGLBAssetById(id) {
  return GLB_ASSET_REGISTRY.find((asset) => asset.id === id) || null;
}

export function getGLBAssetsByCategory(category = 'All') {
  return category === 'All'
    ? [...GLB_ASSET_REGISTRY]
    : GLB_ASSET_REGISTRY.filter((asset) => asset.category === category || asset.group === category);
}
