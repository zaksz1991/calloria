import { getCloudSupabaseClient } from './cloud-platform.js';

const MAX_SNAPSHOT_BYTES = 900_000;
let context = null;
let timer = null;
let pendingSnapshot = null;
let inFlight = false;
let syncEnabled = false;
let syncReady = false;
let lastError = '';
let lastSyncedAt = null;

function cloneSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new TypeError('Employment snapshot must be an object.');
  const clean = structuredClone(snapshot);
  // Do not persist transient UI/interaction objects or browser-only media handles.
  delete clean.viewedArticle;
  clean.cloudSnapshotVersion = 1;
  clean.cloudSnapshotUpdatedAt = new Date().toISOString();
  const bytes = new TextEncoder().encode(JSON.stringify(clean)).byteLength;
  if (bytes > MAX_SNAPSHOT_BYTES) throw new RangeError('Employment snapshot exceeds the 900 KB cloud record limit.');
  return clean;
}

export function configureCloudEmploymentSync(nextContext) {
  context = nextContext && nextContext.userId && nextContext.organizationId ? { ...nextContext } : null;
  syncEnabled = Boolean(context);
  syncReady = false;
  pendingSnapshot = null;
  if (timer) clearTimeout(timer);
  timer = null;
  lastError = '';
  return syncEnabled;
}

export function markCloudEmploymentSyncReady() {
  syncReady = Boolean(syncEnabled && context);
  return syncReady;
}

export function getCloudEmploymentSyncStatus() {
  return { enabled: syncEnabled, saving: inFlight || Boolean(timer), lastError, lastSyncedAt, organizationId: context?.organizationId || null };
}

export async function loadCloudEmploymentSnapshot() {
  if (!syncEnabled || !context) return null;
  const client = await getCloudSupabaseClient();
  const { data, error } = await client
    .from('calloria_employment_records')
    .select('payload,updated_at,revision')
    .eq('organization_id', context.organizationId)
    .eq('user_id', context.userId)
    .eq('record_type', 'employment_snapshot')
    .eq('record_key', 'profile')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  lastSyncedAt = data.updated_at || null;
  lastError = '';
  return data.payload;
}

async function flush() {
  if (!syncEnabled || !syncReady || !context || !pendingSnapshot || inFlight) return;
  const snapshot = pendingSnapshot;
  pendingSnapshot = null;
  inFlight = true;
  try {
    const client = await getCloudSupabaseClient();
    const { data, error } = await client.rpc('save_calloria_employment_snapshot', {
      p_org_id: context.organizationId,
      p_payload: snapshot
    });
    if (error) throw error;
    lastSyncedAt = data?.updated_at || new Date().toISOString();
    lastError = '';
  } catch (error) {
    lastError = String(error?.message || error).slice(0, 300);
    // Keep the newest unsaved snapshot for a later retry; never overwrite a newer pending state.
    if (!pendingSnapshot) pendingSnapshot = snapshot;
  } finally {
    inFlight = false;
    if (pendingSnapshot && syncEnabled) {
      timer = setTimeout(() => { timer = null; void flush(); }, 1800);
    }
  }
}

export function scheduleCloudEmploymentSave(snapshot) {
  if (!syncEnabled || !syncReady || !context) return false;
  try { pendingSnapshot = cloneSnapshot(snapshot); }
  catch (error) { lastError = String(error?.message || error).slice(0, 300); return false; }
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void flush(); }, 900);
  return true;
}

export async function flushCloudEmploymentSave() {
  if (timer) { clearTimeout(timer); timer = null; }
  await flush();
  return getCloudEmploymentSyncStatus();
}
