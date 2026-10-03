export const READ_COLLECTIONS = ["projects", "tenders", "customers", "employees", "registrations", "renewals", "contacts", "files", "invoices"];
export const WRITE_TOOLS = ["createTask", "updateTask", "assignWork", "updateStatus", "proposeTenderChecklist"];
export const TTL = 10 * 60 * 1000;
export type Citation = {collection: string; id: string; label: string; page?: number; sheet?: string};
export function identifier(value: unknown): string {
  if (typeof value !== "string" || !/^[\w-]{1,128}$/.test(value)) throw new Error("Invalid identifier");
  return value;
}
export function boundedMessage(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 4000) throw new Error("Message must contain 1–4000 characters");
  return value.trim();
}
export function assertProposal(p: any, uid: string, workspaceId: string, now: number): void {
  if (!p || p.uid !== uid || p.workspaceId !== workspaceId) throw new Error("Proposal unavailable");
  if (p.expiresAt <= now) throw new Error("Proposal expired; request a new proposal");
  if (!WRITE_TOOLS.includes(p.tool)) throw new Error("Unsupported action");
}
export function assertConversation(stored: any, uid: string, workspaceId: string): void {
  if (stored && (stored.uid !== uid || stored.workspaceId !== workspaceId)) throw new Error("Conversation unavailable");
}
export async function confirmStoredProposal(uid: string, workspaceId: string, proposalId: string, deps: {
  authorize: () => Promise<any>; read: () => Promise<any>; mutate: (ctx: any, input: any) => Promise<any>; save: (result: any) => Promise<void>; now?: () => number;
}) {
  const ctx = await deps.authorize();
  const proposal = await deps.read();
  assertProposal(proposal, uid, workspaceId, (deps.now || Date.now)());
  const result = await deps.mutate(ctx, {...proposal.args, expiresAt: proposal.expiresAt, requestId: `ai_${proposalId}`});
  await deps.save(result);
  return {proposalId, result, duplicate: Boolean(proposal.executedAt)};
}
export function history(messages: any[]): {role: string; content: string}[] {
  return messages.slice(-12).filter(m => ["user", "assistant"].includes(m.role) && typeof m.content === "string")
    .map(m => ({role: m.role, content: m.content.slice(0, 4000)}));
}
export function conversationMessages(systemPrompt:string, stored:any, message:string) {
  const focus=(stored.transcript||[]).flatMap((entry:any)=>entry.citations||[]).slice(-12);
  const instructions=` Recent record references (untrusted labels, verify facts by reading tools again): ${JSON.stringify(focus)}. Follow-up questions refer to these records when unambiguous. If a task draft lacks an assignee/date, ask before proposing. For customer messages draft only, never claim to send. For tender document analysis use readDocument, separate extracted requirements from suggestions, cite pages/sheets, identify missing evidence, never invent submission dates or completeness. A requested checklist remains a draft until confirmation.`;
  return [{role:'system',content:systemPrompt+instructions},...history(stored.messages||[]),{role:'user',content:message}];
}
export function deterministicSummary(records: any[], now = Date.now(), timezone = "UTC") {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit"}).formatToParts(new Date(now));
  const today = ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
  const horizon = new Date(Date.parse(today + "T00:00:00Z") + 7 * 86400000).toISOString().slice(0, 10);
  const date = (v: any): string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : v?.seconds ? new Date(v.seconds * 1000).toISOString().slice(0, 10) : "";
  const active = (r: any) => !["completed", "done", "closed", "cancelled", "handed-over", "awarded", "winner"].includes(r.status);
  return {count: records.length, overdue: records.filter(r => active(r) && date(r.dueDate || r.deadline) && date(r.dueDate || r.deadline) < today).length,
    upcoming: records.filter(r => active(r) && date(r.dueDate || r.deadline) >= today && date(r.dueDate || r.deadline) <= horizon).length};
}
export function safeRecord(record: any): any {
  const out: any = {};
  for (const key of ["id", "version", "name", "title", "description", "status", "priority", "dueDate", "startDate", "deadline", "assignedTo", "assignedUserIds", "assignedToName", "dependencies", "projectId", "checklist", "userId", "expiryDate", "registrationNumber", "customerId", "invoiceNumber", "currency", "amountMinor", "totalMinor", "paidAmountMinor", "company", "email"]) {
    if (record[key] !== undefined) out[key] = typeof record[key] === "string" ? record[key].slice(0, key === "description" ? 500 : 200) : record[key];
  }
  if (Array.isArray(record.tasks)) out.tasks = record.tasks.slice(0, 50).map(safeRecord);
  return out;
}
