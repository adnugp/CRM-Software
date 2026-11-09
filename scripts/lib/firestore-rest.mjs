// scripts/lib/firestore-rest.mjs
// Firestore over REST, the same way for the local emulator and the live project.
// Live uses no credentials: it only works while the old open rules are deployed.

// The live web API key is public (it's in every page of the app).
const LIVE_API_KEY = 'AIzaSyBcCR3upbuvG1fQFUOE9qLnITa8tk41cXI';

export function target(name) {
  if (name === 'emulator') {
    return { name, project: 'demo-crm', root: 'http://127.0.0.1:8085/v1', key: '',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' } };
  }
  if (name === 'live') {
    return { name, project: 'crm-gpt-2026', root: 'https://firestore.googleapis.com/v1', key: LIVE_API_KEY,
      headers: { 'Content-Type': 'application/json' } };
  }
  throw new Error(`Unknown target "${name}". Use emulator or live.`);
}

const documents = (t) => `${t.root}/projects/${t.project}/databases/(default)/documents`;
const withKey = (t, url) => (t.key ? `${url}${url.includes('?') ? '&' : '?'}key=${t.key}` : url);

async function send(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${url.replace(/key=[^&]+/, 'key=…')} -> ${res.status} ${await res.text()}`);
  return res.json();
}

/** Every document in a top-level collection. */
export async function listAll(t, collection) {
  const docs = [];
  let pageToken = '';
  do {
    const page = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const body = await send(withKey(t, `${documents(t)}/${collection}?pageSize=300${page}`), { headers: t.headers });
    docs.push(...(body.documents ?? []));
    pageToken = body.nextPageToken ?? '';
  } while (pageToken);
  return docs;
}

/** Apply writes in batches of 500 (Firestore's limit per commit). */
export async function commit(t, writes, onBatch = () => {}) {
  for (let i = 0; i < writes.length; i += 500) {
    const batch = writes.slice(i, i + 500);
    await send(withKey(t, `${documents(t)}:commit`), { method: 'POST', headers: t.headers, body: JSON.stringify({ writes: batch }) });
    onBatch(Math.min(i + 500, writes.length), writes.length);
  }
}
