import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp, GeoPoint } from 'firebase-admin/firestore';
import { safeId } from './migration-plan.mjs';
export function args(argv = process.argv.slice(2)) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) throw Error(`Unexpected argument ${argv[i]}`);
    const key = argv[i].slice(2);
    if (key in result) throw Error(`Duplicate --${key}`);
    result[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return result;
}
export function connect(options) {
  if (typeof options.project !== 'string' || !/^[a-z][a-z0-9-]{4,62}$/.test(options.project)) throw Error('--project explicitly required');
  if (!safeId(options.workspace)) throw Error('--workspace explicitly required');
  if (options.apply !== undefined && options.apply !== true) throw Error('--apply is a flag; do not supply a value');
  if (options.apply && options['confirm-project'] !== options.project) throw Error('--apply requires matching --confirm-project');
  const app = initializeApp({ projectId: options.project, credential: applicationDefault(), ...(options.bucket ? { storageBucket: options.bucket } : {}) });
  return { app, db: getFirestore(app) };
}
export function encode(value) {
  if (value instanceof Timestamp) return { $type: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (value instanceof GeoPoint) return { $type: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  if (Buffer.isBuffer(value)) return { $type: 'bytes', data: value.toString('base64') };
  if (value?.path && typeof value.get === 'function') return { $type: 'reference', path: value.path };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  return value;
}
export function decode(value, db) {
  if (value?.$type === 'timestamp') return new Timestamp(value.seconds, value.nanoseconds);
  if (value?.$type === 'geopoint') return new GeoPoint(value.latitude, value.longitude);
  if (value?.$type === 'bytes') return Buffer.from(value.data, 'base64');
  if (value?.$type === 'reference') return db.doc(value.path);
  if (Array.isArray(value)) return value.map(v => decode(v, db));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v, db)]));
  return value;
}
export async function readTree(db, root) {
  const result = [];
  async function visit(ref) {
    const snap = await ref.get();
    if (snap.exists) result.push({ path: ref.path, data: encode(snap.data()) });
    // listDocuments includes missing parent documents that still have descendants.
    for (const collection of await ref.listCollections()) for (const child of await collection.listDocuments()) await visit(child);
  }
  await visit(db.doc(root));
  return result;
}
