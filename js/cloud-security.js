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
  // Browser autofill and copy/paste can introduce non-breaking spaces,
  // full-width punctuation or invisible format characters. Normalise those
  // without deleting visible characters from the address.
  const email = String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .trim()
    .toLowerCase();

  const invalid = () => new TypeError(
    'Enter an email address in the format name@example.com. Check for spaces, extra @ characters or a missing domain.'
  );

  if (!email || email.length > 254 || /\s/.test(email)) throw invalid();

  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@') || at === email.length - 1) throw invalid();

  const local = email.slice(0, at);
  const rawDomain = email.slice(at + 1);
  const atomPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
  if (
    local.length > 64 ||
    !atomPattern.test(local) ||
    local.startsWith('.') || local.endsWith('.') || local.includes('..')
  ) throw invalid();

  let domain;
  try {
    // URL.hostname applies the browser's IDN-to-ASCII conversion for
    // internationalised domain names before DNS-label validation.
    const parsed = new URL(`https://${rawDomain}`);
    if (parsed.username || parsed.password || parsed.port || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw invalid();
    }
    domain = parsed.hostname.toLowerCase();
  } catch {
    throw invalid();
  }

  const labels = domain.split('.');
  if (
    labels.length < 2 ||
    labels.some(label =>
      !label || label.length > 63 ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
    )
  ) throw invalid();

  const normalised = `${local}@${domain}`;
  if (normalised.length > 254) throw invalid();
  return normalised;
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
