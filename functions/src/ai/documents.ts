import {getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {createHash} from "node:crypto";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {authorizeContext, getRecord, listRecords, WorkspaceContext} from "../domain";
import {identifier} from "./core";
import {embed, embeddingConfiguration, cosineSimilarity} from "./embeddings";
import {aiQuota} from "./limits";

export type DocumentChunk = {text: string; page?: number; sheet?: string};
async function adapter(name: string): Promise<any> {
  try {return await import(name);} catch {throw new Error(`Document extraction unavailable: install the ${name} adapter`);}
}
export function chunkText(text: string, citation: {page?: number; sheet?: string} = {}): DocumentChunk[] {
  const normalized = text.replace(/\u0000/g, "").trim().slice(0, 100000);
  const chunks: DocumentChunk[] = [];
  for (let start = 0; start < normalized.length; start += 1000) chunks.push({text: normalized.slice(start, start + 1000), ...citation});
  return chunks;
}
async function ocr(buffer: Buffer, mimeType: string): Promise<DocumentChunk[]> {
  if (process.env.NODE_ENV === "test") throw new Error("Live OCR calls disabled in tests");
  const endpoint = process.env.AI_OCR_ENDPOINT;
  if (!endpoint || !process.env.AI_OCR_API_KEY) throw new Error("Scanned document OCR unavailable: configure AI_OCR_ENDPOINT and AI_OCR_API_KEY");
  if (new URL(endpoint).protocol !== "https:") throw new Error("OCR endpoint must use HTTPS");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(endpoint, {method: "POST", signal: controller.signal, headers: {"Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_OCR_API_KEY}`}, body: JSON.stringify({mimeType, contentBase64: buffer.toString("base64")})});
    if (!response.ok) throw new Error("OCR provider unavailable");
    const data: any = await response.json();
    if (!Array.isArray(data.pages)) throw new Error("OCR provider must return pages with page numbers and text");
    return data.pages.flatMap((page: any) => typeof page.text === "string" && Number.isInteger(page.page) && page.page > 0 ? chunkText(page.text, {page: page.page}) : []).slice(0, 100);
  } finally {clearTimeout(timer);}
}
export async function extractDocument(buffer: Buffer, mimeType: string): Promise<DocumentChunk[]> {
  if (buffer.byteLength > 15 * 1024 * 1024) throw new Error("Document exceeds 15 MB extraction limit");
  if (["text/plain", "text/csv", "text/markdown"].includes(mimeType)) return chunkText(buffer.toString("utf8"));
  if (mimeType === "application/pdf") {
    const pdf = await adapter("pdf-parse");
    const parser = new pdf.PDFParse({data: new Uint8Array(buffer)});
    try {
      const result = await parser.getText();
      const chunks = (result.pages || []).flatMap((page: any, index: number) => chunkText(page.text || "", {page: page.num || index + 1})).slice(0, 100);
      return chunks.length ? chunks : await ocr(buffer, mimeType);
    } finally {await parser.destroy();}
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await adapter("mammoth");
    const result = await (mammoth.default || mammoth).extractRawText({buffer});
    return chunkText(result.value);
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    const module = await adapter("exceljs");
    const excel = module.default || module;
    const workbook = new excel.Workbook();
    await workbook.xlsx.load(buffer);
    const chunks: DocumentChunk[] = [];
    let remainingCharacters = 100000;
    for (const worksheet of workbook.worksheets) {
      if (remainingCharacters <= 0) break;
      let text = "";
      worksheet.eachRow((row: any) => {
        if (text.length >= remainingCharacters) return;
        const cells: string[] = [];
        row.eachCell({includeEmpty: true}, (cell: any) => {
          // ExcelJS does not execute formulas; cell.text exposes cached values.
          if (cells.length < 256) cells.push(String(cell.text || "").slice(0, 1000));
        });
        text += cells.join("\t").slice(0, remainingCharacters - text.length) + "\n";
      });
      text = text.slice(0, remainingCharacters);
      remainingCharacters -= text.length;
      chunks.push(...chunkText(text, {sheet: worksheet.name}));
    }
    return chunks.slice(0, 100);
  }
  if (mimeType.startsWith("image/")) return ocr(buffer, mimeType);
  throw new Error("Unsupported document type");
}
/** The configured scanner must return an explicit boolean verdict. */
export async function scanBuffer(buffer: Buffer, mimeType: string): Promise<{clean: boolean; sha256: string}> {
  const endpoint = process.env.DOCUMENT_SCAN_ENDPOINT;
  if (!endpoint || !process.env.DOCUMENT_SCAN_API_KEY) throw new Error("Malware scanning unavailable; document remains quarantined");
  if (process.env.NODE_ENV === "test") throw new Error("Live scanning disabled in tests");
  if (new URL(endpoint).protocol !== "https:") throw new Error("Scanner endpoint must use HTTPS");
  if (buffer.byteLength > 15 * 1024 * 1024) throw new Error("Document exceeds 15 MB scanning limit");
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(endpoint, {method: "POST", signal: controller.signal, headers: {"Content-Type": "application/json", Authorization: `Bearer ${process.env.DOCUMENT_SCAN_API_KEY}`}, body: JSON.stringify({mimeType, sha256, contentBase64: buffer.toString("base64")})});
    if (!response.ok) throw new Error("Scanner unavailable; document remains quarantined");
    const result: any = await response.json();
    if (typeof result.clean !== "boolean") throw new Error("Invalid scanner verdict; document remains quarantined");
    return {clean: result.clean, sha256};
  } finally {clearTimeout(timer);}
}
export const documentScan = onCall({timeoutSeconds: 90, memory: "512MiB", secrets: process.env.DOCUMENT_SCAN_ENDPOINT ? ["DOCUMENT_SCAN_API_KEY"] : []}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to scan a document");
  try {
    const ctx = await authorizeContext(request.auth.uid, identifier(request.data?.workspaceId));
    if (!["admin", "manager"].includes(ctx.role)) throw new HttpsError("permission-denied", "Management must initiate scanning");
    const fileId = identifier(request.data?.fileId);
    const file = await getRecord(ctx, "files", fileId);
    if (!file || file.quarantine !== "pending" || typeof file.storagePath !== "string" || !file.storagePath.startsWith(`workspaces/${ctx.workspaceId}/documents/${fileId}/${identifier(file.currentVersionId)}/`)) throw new HttpsError("failed-precondition", "An accessible quarantined current document version is required");
    const selectedVersion = file.versions?.find((version: any) => version.id === file.currentVersionId);
    if (!selectedVersion || selectedVersion.storagePath !== file.storagePath || selectedVersion.quarantine !== "pending") throw new HttpsError("failed-precondition", "Version metadata must match the current upload");
    const object = getStorage().bucket().file(file.storagePath);
    const [before] = await object.getMetadata();
    if (Number(before.size) > 15 * 1024 * 1024) throw new Error("Document exceeds 15 MB scanning limit");
    const [buffer] = await object.download();
    const verdict = await scanBuffer(buffer, String(file.mimeType || before.contentType || ""));
    const [after] = await object.getMetadata();
    if (before.generation !== after.generation) throw new Error("Storage object changed during scan");
    const fresh = await authorizeContext(ctx.uid, ctx.workspaceId);
    if (!(await getRecord(fresh, "files", fileId))) throw new HttpsError("permission-denied", "File access changed");
    const db = getFirestore();
    const ref = db.doc(`workspaces/${ctx.workspaceId}/files/${fileId}`);
    const audit = db.collection(`workspaces/${ctx.workspaceId}/audit`).doc();
    await db.runTransaction(async tx => {
      const [current, member] = await Promise.all([tx.get(ref), tx.get(db.doc(`workspaces/${ctx.workspaceId}/members/${ctx.uid}`))]);
      const data = current.data();
      if (!member.data()?.active || !["admin", "manager"].includes(member.data()?.role)) throw new HttpsError("permission-denied", "Management membership changed");
      if (!data || data.version !== file.version || data.storagePath !== file.storagePath || data.quarantine !== "pending") throw new HttpsError("aborted", "Document changed during scan");
      const quarantine = verdict.clean ? "clean" : "rejected";
      const versions = Array.isArray(data.versions) ? data.versions.map((v: any) => v.storagePath === file.storagePath ? {...v, quarantine, sha256: verdict.sha256, generation: after.generation} : v) : [];
      tx.update(ref, {quarantine, versions, sha256: verdict.sha256, generation: after.generation, version: data.version + 1, updatedAt: new Date().toISOString(), updatedBy: ctx.uid});
      tx.update(db.doc(`workspaces/${ctx.workspaceId}`), {lastMutationAt: new Date().toISOString()});
      tx.create(audit, {action: "document.scan", collection: "files", recordId: fileId, actorId: ctx.uid, result: quarantine, at: new Date().toISOString()});
    });
    return {fileId, quarantine: verdict.clean ? "clean" : "rejected"};
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("failed-precondition", error instanceof Error ? error.message : "Scanning unavailable; file remains quarantined");
  }
});
async function accessibleFiles(ctx: WorkspaceContext) {
  const files: any[] = [];
  let cursor: string | null = null;
  // Bounded scan; response states the search scope rather than implying exhaustive search.
  for (let page = 0; page < 5; page++) {
    const result = await listRecords(ctx, "files", {pageSize: 100, ...(cursor ? {cursor} : {})});
    files.push(...result.records);
    cursor = result.cursor;
    if (!cursor) break;
  }
  return files;
}
export async function searchDocuments(ctx: WorkspaceContext, query: string) {
  const fresh = await authorizeContext(ctx.uid, ctx.workspaceId);
  const files = await accessibleFiles(fresh);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 10);
  if (!terms.length) throw new Error("A document search query is required");
  const vectors = await embed([query]);
  const signature = embeddingConfiguration();
  const matches: any[] = [];
  for (const file of files.filter(file => file.quarantine === "clean").slice(0, 100)) {
    const index = (await getFirestore().doc(`workspaces/${ctx.workspaceId}/aiDocumentIndex/${file.id}`).get()).data();
    if (!index || index.version !== file.version) continue;
    for (const chunk of index.chunks || []) {
      const semantic = vectors && signature === index.embeddingConfiguration && Array.isArray(chunk.embedding);
      const score = semantic ? cosineSimilarity(vectors![0], chunk.embedding) : terms.reduce((count, term) => count + (chunk.text.toLowerCase().includes(term) ? 1 : 0), 0) / terms.length;
      if (score > 0) matches.push({collection: "files", id: file.id, sourceVersion: file.version, label: file.name || file.filename || file.id, text: chunk.text, ...(chunk.page ? {page: chunk.page} : {}), ...(chunk.sheet ? {sheet: chunk.sheet} : {}), score, mode: semantic ? "semantic" : "lexical"});
    }
  }
  await authorizeContext(ctx.uid, ctx.workspaceId);
  // Permission changes during embedding/compute are rechecked before text leaves the server.
  const ranked = matches.sort((a, b) => b.score - a.score).slice(0, 12);
  const authorized: any[] = [];
  for (const match of ranked) {const record = await getRecord(await authorizeContext(ctx.uid, ctx.workspaceId), "files", match.id); if (record?.quarantine === "clean" && record.version === match.sourceVersion) authorized.push(match);}
  return {matches: authorized, capability: vectors ? "semantic for matching indexed model; lexical fallback for older indexes" : "lexical only: embeddings are not configured", scope: "Up to 100 accessible, clean, indexed files from the first 500 records", untrustedData: true};
}
/** Read existing verified extraction without embedding or OCR provider calls. */
export async function readIndexedDocument(ctx:WorkspaceContext, fileId:string) {
  const fresh=await authorizeContext(ctx.uid,ctx.workspaceId);
  const file=await getRecord(fresh,'files',identifier(fileId));
  if(!file || file.quarantine!=='clean')throw new Error('An accessible clean document is required.');
  const index=(await getFirestore().doc(`workspaces/${ctx.workspaceId}/aiDocumentIndex/${fileId}`).get()).data();
  if(!index || index.version!==file.version)throw new Error('Document analysis unavailable: index the current clean document version first.');
  let characters=0;
  const chunks:any[]=[];
  for(const chunk of index.chunks||[]){
    if(typeof chunk.text!=='string')continue;
    const text=chunk.text.slice(0,Math.max(0,12000-characters));
    if(!text)break;
    chunks.push({text,...(chunk.page?{page:chunk.page}:{}),...(chunk.sheet?{sheet:chunk.sheet}:{})});characters+=text.length;
    if(chunks.length>=12)break;
  }
  const current=await getRecord(await authorizeContext(ctx.uid,ctx.workspaceId),'files',fileId);
  if(!current||current.quarantine!=='clean'||current.version!==file.version)throw new Error('Document access or version changed.');
  return {id:fileId,name:String(file.name||fileId),chunks,partial:true,scope:'First 12 indexed chunks, at most 12,000 characters. Extraction itself covers at most 40 chunks. This is not a complete document review.',untrustedData:true};
}
export const aiIndexDocument = onCall({timeoutSeconds: 120, memory: "512MiB", secrets: [
  ...(process.env.AI_OCR_ENDPOINT ? ["AI_OCR_API_KEY"] : []),
  ...(process.env.AI_EMBEDDING_ENDPOINT && process.env.AI_PROVIDER !== "ollama" ? ["AI_API_KEY"] : []),
  ...(process.env.AI_EMBEDDING_AUTH === "separate" ? ["AI_EMBEDDING_API_KEY"] : []),
]}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to index a document");
  try {
    const ctx = await authorizeContext(request.auth.uid, identifier(request.data?.workspaceId));
    const id = identifier(request.data?.fileId);
    await aiQuota(ctx);
    const file = await getRecord(ctx, "files", id);
    if (!file || file.quarantine !== "clean") throw new HttpsError("permission-denied", "An accessible, clean file is required");
    if (typeof file.storagePath !== "string" || !file.storagePath.startsWith(`workspaces/${ctx.workspaceId}/documents/${id}/${identifier(file.currentVersionId)}/`)) throw new Error("File storage path does not match the current tenant document version");
    const selectedVersion = file.versions?.find((version: any) => version.id === file.currentVersionId);
    if (!selectedVersion || selectedVersion.quarantine !== "clean" || selectedVersion.storagePath !== file.storagePath || !file.sha256 || !file.generation || selectedVersion.sha256 !== file.sha256 || selectedVersion.generation !== file.generation) throw new Error("A verified scan receipt for this exact document version is required");
    const storageFile = getStorage().bucket().file(file.storagePath);
    const [metadata] = await storageFile.getMetadata();
    if (metadata.generation !== file.generation) throw new Error("Document generation does not match its scan receipt");
    if (Number(metadata.size) > 15 * 1024 * 1024) throw new Error("Document exceeds 15 MB extraction limit");
    const [buffer] = await storageFile.download();
    if (createHash("sha256").update(buffer).digest("hex") !== file.sha256) throw new Error("Document contents do not match its scan receipt");
    const extracted = (await extractDocument(buffer, String(file.mimeType || metadata.contentType || ""))).slice(0, 40);
    const vectors = await embed(extracted.map(chunk => chunk.text));
    const chunks = extracted.map((chunk, i) => ({...chunk, ...(vectors ? {embedding: vectors[i]} : {})}));
    const fresh = await authorizeContext(ctx.uid, ctx.workspaceId);
    const current = await getRecord(fresh, "files", id);
    if (!current || current.version !== file.version || current.quarantine !== "clean") throw new Error("Document changed during extraction");
    await getFirestore().doc(`workspaces/${ctx.workspaceId}/aiDocumentIndex/${id}`).set({version: file.version, chunks, embeddingConfiguration: embeddingConfiguration(), indexedAt: Date.now()});
    return {fileId: id, chunks: chunks.length, status: chunks.length ? "indexed" : "empty", capability: vectors ? "semantic" : "lexical only: embeddings are not configured", scope: "First 40 chunks (up to 40,000 characters)"};
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("failed-precondition", error instanceof Error ? error.message : "Document indexing unavailable");
  }
});
