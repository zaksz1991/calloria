export const CLOUD_ROLE_PERMISSIONS = Object.freeze({
  owner: ['org:manage','members:manage','members:read','policies:manage','audit:read','operations:read','reports:read'],
  admin: ['org:manage','members:manage','members:read','policies:manage','audit:read','operations:read','reports:read'],
  manager: ['members:read','policies:read','audit:read','operations:read','reports:read'],
  supervisor: ['members:read','operations:read','reports:read'],
  qa: ['operations:read','reports:read'],
  agent: ['operations:own'],
  trainee: ['knowledge:read','operations:own']
});

export const CLOUD_DEFAULT_POLICY = Object.freeze({
  voiceResponseTargetSeconds: 30,
  digitalResponseTargetMinutes: 15,
  qaPassMark: 85,
  promotionThreshold: 80,
  maxConcurrentChats: 2,
  dataRetentionDays: 90,
  departments: ['Inbound Voice','Outbound Voice','Email Support','Social Media','Live Chat','IT Support','Quality Assurance','Customer Experience','Fraud and Security','Back Office']
});

export function canCloudRole(role, permission) {
  return Boolean(CLOUD_ROLE_PERMISSIONS[role]?.includes(permission));
}

function isPrivilegedJwt(key) {
  const payload = String(key).split('.')[1];
  if (!payload || typeof atob !== 'function') return false;
  try {
    const normalised = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalised.padEnd(Math.ceil(normalised.length / 4) * 4, '='));
    const claims = JSON.parse(decoded);
    return ['service_role', 'supabase_admin'].includes(String(claims.role || '').toLowerCase());
  } catch { return false; }
}

export function resolveSupabaseConfig(env = {}) {
  const url = String(env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url && !key) return { mode: 'demo', url: '', key: '' };
  if (!url || !key) return { mode: 'misconfigured', url, key: '' };
  let validUrl = false;
  try {
    const parsed = new URL(url);
    validUrl = parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch { /* invalid configuration */ }
  const validKey = /^(sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.test(key);
  if (!validUrl || !validKey || isPrivilegedJwt(key)) {
    return { mode: 'misconfigured', url, key: '' };
  }
  return { mode: 'cloud', url, key };
}

export function normaliseInvitationEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new TypeError('Enter a valid email address.');
  }
  return email;
}

export function validateCloudPolicy(input) {
  const ranges = {
    voiceResponseTargetSeconds: [5, 600],
    digitalResponseTargetMinutes: [1, 1440],
    qaPassMark: [0, 100],
    promotionThreshold: [0, 100],
    maxConcurrentChats: [1, 10],
    dataRetentionDays: [1, 3650]
  };
  const policy = {};
  for (const [key, [min, max]] of Object.entries(ranges)) {
    const value = Number(input?.[key]);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new RangeError(`${key} must be a whole number between ${min} and ${max}.`);
    }
    policy[key] = value;
  }
  const departments = [...new Set((Array.isArray(input?.departments) ? input.departments : [])
    .map(value => String(value).trim()).filter(Boolean))];
  if (!departments.length || departments.length > 40 || departments.some(value => value.length < 2 || value.length > 60)) {
    throw new RangeError('Provide between 1 and 40 department names, each 2–60 characters long.');
  }
  policy.departments = departments;
  return policy;
}
