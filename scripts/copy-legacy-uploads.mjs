import { readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import { args, connect } from './admin-common.mjs';
import { safeId } from './migration-plan.mjs';
const options = args();
const { app, db } = connect(options);
if (typeof options.bucket !== 'string' || typeof options.root !== 'string' || typeof options.manifest !== 'string' || typeof options.output !== 'string') throw Error('--bucket --root --manifest --output required');
if (options.apply && options['confirm-bucket'] !== options.bucket) throw Error('--apply requires matching --confirm-bucket');
const manifest = JSON.parse(await readFile(options.manifest, 'utf8'));
if (manifest.projectId !== options.project || manifest.workspaceId !== options.workspace || !safeId(manifest.migrationId) || !Array.isArray(manifest.files)) throw Error('Manifest target mismatch');
const root = await realpath(options.root), planned = [], seen = new Set();
for (const file of manifest.files) {
  if (![file.recordId, file.versionId].every(safeId) || typeof file.relativePath !== 'string' || !file.mimeType || seen.has(`${file.recordId}/${file.versionId}`)) throw Error('Invalid or duplicate file manifest entry');
  seen.add(`${file.recordId}/${file.versionId}`);
  const local = await realpath(path.resolve(root, file.relativePath));
  const relative = path.relative(root, local);
  const metadata = await stat(local);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !metadata.isFile()) throw Error('File escapes approved root');
  if (metadata.size >= 20 * 1024 * 1024) throw Error('Legacy file exceeds pending-upload size limit');
  const bytes = await readFile(local), hash = createHash('sha256').update(bytes).digest('hex');
  const storagePath = `workspaces/${options.workspace}/documents/${file.recordId}/${file.versionId}/${path.basename(local)}`;
  const record = await db.doc(`workspaces/${options.workspace}/files/${file.recordId}`).get();
  if (!record.exists || record.data()._migration?.id !== manifest.migrationId || record.data().quarantine !== 'pending') throw Error(`Missing migration-owned pending file ${file.recordId}`);
  planned.push({ ...file, local, hash, size: bytes.length, storagePath });
}
await writeFile(options.output, JSON.stringify({ projectId: options.project, workspaceId: options.workspace, migrationId: manifest.migrationId, files: planned }, null, 2), { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ dryRun: !options.apply, files: planned.map(({ local, ...file }) => file) }, null, 2));
if (options.apply) {
  const bucket = getStorage(app).bucket(options.bucket);
  for (const file of planned) {
    // create-only prevents overwriting an existing version. Never sets Firebase download tokens.
    await db.runTransaction(async tx => {
      const ref = db.doc(`workspaces/${options.workspace}/files/${file.recordId}`), snap = await tx.get(ref);
      if (snap.data()?._migration?.id !== manifest.migrationId || snap.data()?.quarantine !== 'pending') throw Error('File ownership changed; uploaded object remains quarantined for operator review');
      const versions = snap.data().versions || [];
      const existing = versions.find(v => v.id === file.versionId);
      if (existing && (existing.storagePath !== file.storagePath || existing.sha256 !== file.hash)) throw Error('Conflicting version already exists');
      if (!existing) tx.update(ref, { versions: [...versions, { id: file.versionId, storagePath: file.storagePath, filename: path.basename(file.local), mimeType: file.mimeType, size: file.size, sha256: file.hash, quarantine: 'pending' }], currentVersionId: file.versionId, storageStatus: 'pending-upload' });
    });
    const object = bucket.file(file.storagePath);
    const [exists] = await object.exists();
    if (exists) {
      const [metadata] = await object.getMetadata();
      if (metadata.metadata?.migrationId !== manifest.migrationId || metadata.metadata?.sha256 !== file.hash) throw Error('Conflicting Storage object exists');
    } else await bucket.upload(file.local, { destination: file.storagePath, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: file.mimeType, metadata: { migrationId: manifest.migrationId, quarantine: 'pending', sha256: file.hash } } });
  }
}
