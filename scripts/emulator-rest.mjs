// Shared helpers for talking to the LOCAL Firebase emulators over REST.
// Only ever points at 127.0.0.1 and the "demo-crm" project.

export const PROJECT = 'demo-crm';
export const AUTH = 'http://127.0.0.1:9099';
export const FIRESTORE = 'http://127.0.0.1:8085';

// Test logins (local emulator only) all share one password.
export const TEST_PASSWORD = 'Test@1234';

// "Bearer owner" is the emulator's admin credential: it bypasses security rules.
const OWNER = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };

// Encode a plain JS value as a Firestore REST "Value".
const encode = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'object') return { mapValue: { fields: encodeFields(v) } };
  return { stringValue: String(v) };
};
const encodeFields = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined).map(([k, v]) => [k, encode(v)]));

export const request = async (url, init = {}) => {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${url} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json().catch(() => null);
};

// Create or fully replace a Firestore document.
export const put = (collection, id, data) =>
  request(`${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/${collection}/${id}`, {
    method: 'PATCH',
    headers: OWNER,
    body: JSON.stringify({ fields: encodeFields(data) }),
  });

export async function assertEmulatorsRunning() {
  try {
    await fetch(`${AUTH}/`);
    await fetch(`${FIRESTORE}/`);
  } catch {
    console.error('Emulators are not running. Start them first with: npm run emulators');
    process.exit(1);
  }
}

export const signUp = (email, password, displayName) =>
  request(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
  });

// Create the login, or reset its password/name if the email already exists.
// Returns the login's uid.
export async function upsertLogin(email, password, displayName) {
  const found = await request(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`, {
    method: 'POST',
    headers: OWNER,
    body: JSON.stringify({ email: [email] }),
  });
  const existing = found?.users?.[0];
  if (!existing) return (await signUp(email, password, displayName)).localId;

  await request(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, {
    method: 'POST',
    headers: OWNER,
    body: JSON.stringify({ localId: existing.localId, password, displayName }),
  });
  return existing.localId;
}

// Wipe every login and document in the emulators.
export async function clearEmulators() {
  await request(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await request(`${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
}

// Create a login with a fixed uid (so it matches a users/{uid} profile), or
// reset its email, password and name if that uid already exists.
export async function upsertLoginWithUid(uid, email, password, displayName) {
  const accounts = `${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts`;
  const found = await request(`${accounts}:lookup`, { method: 'POST', headers: OWNER, body: JSON.stringify({ localId: [uid] }) });
  const body = JSON.stringify({ localId: uid, email, password, displayName });
  if (found?.users?.length) await request(`${accounts}:update`, { method: 'POST', headers: OWNER, body });
  else await request(accounts, { method: 'POST', headers: OWNER, body });
}
