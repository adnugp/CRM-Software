export type Role = "admin" | "manager" | "user" | "client";
export const collections = [
  "projects",
  "tenders",
  "employees",
  "registrations",
  "payments",
  "subscriptions",
  "partners",
  "files",
  "customers",
  "contacts",
  "invoices",
  "milestones",
  "comments",
  "renewals",
  "tasks",
] as const;
export const finance = ["payments", "subscriptions", "invoices"];
export type Data = Record<string, any>;
export function canRead(
  ctx: { uid: string; role: Role },
  collection: string,
  record: Data,
): boolean {
  if (finance.includes(collection))
    return ctx.role === "admin" || ctx.role === "manager";
  if (ctx.role === "admin" || ctx.role === "manager") return true;
  if (ctx.role === "client")
    return (
      ["projects", "files", "milestones", "comments"].includes(collection) &&
      Array.isArray(record.sharedWith) &&
      record.sharedWith.includes(ctx.uid)
    );
  if (["employees", "contacts", "customers", "partners"].includes(collection))
    return true;
  return (
    record.assignedTo === ctx.uid ||
    (Array.isArray(record.assignedUserIds) &&
      record.assignedUserIds.includes(ctx.uid))
  );
}
export function canWrite(
  ctx: { uid: string; role: Role },
  collection: string,
  action: string,
  record: Data,
  data: Data = {},
): boolean {
  if (ctx.role === "client") return false;
  if (
    ctx.role === "user" &&
    ["employees", "customers", "contacts", "partners", "milestones"].includes(
      collection,
    )
  )
    return false;
  if (
    ctx.role === "user" &&
    Object.keys(data).some((k) =>
      [
        "evaluationNotes", "approvalSteps",
  "bidAmount",
        "bidAmountMinor",
        "budget",
        "budgetMinor",
        "amount",
        "amountMinor",
        "costs",
        "total",
        "totalMinor",
        "tax",
        "taxMinor",
        "lineItems",
        "paidAmountMinor",
      ].includes(k),
    )
  )
    return false;
  if (action === "delete") return ctx.role === "admin";
  if (finance.includes(collection))
    return ctx.role === "admin" || ctx.role === "manager";
  if (ctx.role === "admin" || ctx.role === "manager") return true;
  return action === "create" || canRead(ctx, collection, record);
}
export function moneyToMinor(amount: number): number {
  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    !Number.isSafeInteger(Math.round(amount * 100))
  )
    throw new Error("Invalid monetary amount");
  return Math.round((amount + Number.EPSILON) * 100);
}
const allowed = new Set([
  "clarifications", "approvalSteps",
  "bidAmount",
  "bidAmountMinor",
  "evaluationNotes",
  "registrationNumber",
  "previousRegistrationId",
  "handoverChecklist",
  "registrationId",
  "amountMinor",
  "budgetMinor",
  "paidAmountMinor",
  "taxMinor",
  "totalMinor",
  "userId",
  "name",
  "description",
  "company",
  "clientId",
  "clientName",
  "belongsTo",
  "divisionId",
  "status",
  "assignedTo",
  "assignedToName",
  "assignedUserIds",
  "deadline",
  "document",
  "documentFile",
  "documents",
  "budget",
  "tasks",
  "costs",
  "projectId",
  "sourceTenderId",
  "rfqCode",
  "portal",
  "department",
  "position",
  "phone",
  "email",
  "joinDate",
  "type",
  "registrationDate",
  "expiryDate",
  "amount",
  "dueDate",
  "provider",
  "billingCycle",
  "nextBillingDate",
  "partnershipType",
  "category",
  "since",
  "uploadedAt",
  "uploadedBy",
  "recordCollection",
  "recordId",
  "versions",
  "currentVersionId",
  "quarantine",
  "sharedWith",
  "address",
  "notes",
  "contactId",
  "customerId",
  "invoiceNumber",
  "currency",
  "issueDate",
  "lineItems",
  "tax",
  "total",
  "paidAt",
  "completedAt",
  "priority",
  "date",
  "checklist",
  "body",
  "parentId",
  "renewalDate",
  "storagePath",
  "size",
  "mimeType",
  "filename",
]);
const statuses: Record<string, string[]> = {
  milestones: ["pending", "completed"],
  renewals: ["pending", "completed"],
  projects: ["running", "in-progress", "completed", "handed-over"],
  tenders: [
    "running",
    "submitted",
    "cancelled",
    "to-be-evaluated",
    "winner",
    "awarded",
  ],
  tasks: ["pending", "in-progress", "completed"],
  payments: ["pending", "paid", "overdue"],
  invoices: ["draft", "issued", "sent", "paid", "overdue", "cancelled"],
  registrations: ["active", "expired", "pending"],
  subscriptions: ["active", "cancelled", "expired"],
  employees: ["active", "inactive"],
  partners: ["active", "inactive"],
};
export function validateData(collection: string, input: Data): Data {
  if (!collections.includes(collection as any))
    throw new Error("Unsupported collection");
  if (!input || Array.isArray(input) || typeof input !== "object")
    throw new Error("Data must be an object");
  if (JSON.stringify(input).length > 200000)
    throw new Error("Record too large");
  const out: Data = {};
  function inspect(value: any, depth = 0): void {
    if (depth > 8) throw new Error("Data too deeply nested");
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        if (["data", "__proto__", "constructor", "prototype"].includes(k))
          throw new Error("Embedded uploads are forbidden");
        inspect(v, depth + 1);
      }
    }
  }
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.has(key)) throw new Error(`Unsupported field: ${key}`);
    inspect(value);
    if (typeof value === "string" && value.length > 20000)
      throw new Error("Field too long");
    if (key.endsWith("Minor")) {
      if (!Number.isSafeInteger(value) || value < 0)
        throw new Error("Money must be nonnegative integer minor units");
      out[key] = value;
    } else if (
      ["budget", "amount", "tax", "total", "bidAmount"].includes(key)
    ) {
      if (typeof value !== "number") throw new Error("Money must be numeric");
      out[key + "Minor"] = moneyToMinor(value);
      out[key] = value;
    } else out[key] = value;
  }
  if (
    out.status &&
    statuses[collection] &&
    !statuses[collection].includes(out.status)
  )
    throw new Error("Invalid status");
  if (
    out.name !== undefined &&
    (typeof out.name !== "string" || !out.name.trim())
  )
    throw new Error("Name required");
  for (const key of ["assignedUserIds", "sharedWith"])
    if (
      out[key] !== undefined &&
      (!Array.isArray(out[key]) ||
        out[key].length > 100 ||
        out[key].some((v: any) => typeof v !== "string"))
    )
      throw new Error("Invalid assignment");
  for (const key of [
    "deadline",
    "dueDate",
    "expiryDate",
    "registrationDate",
    "joinDate",
    "nextBillingDate",
    "issueDate",
    "renewalDate",
    "date",
  ])
    if (
      out[key] !== undefined &&
      (typeof out[key] !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(out[key]) ||
        isNaN(Date.parse(out[key])) ||
        new Date(out[key]).toISOString().slice(0, 10) !== out[key])
    )
      throw new Error("Invalid date");
  if (
    out.tasks !== undefined &&
    (!Array.isArray(out.tasks) ||
      out.tasks.length > 500 ||
      out.tasks.some(
        (t: Data) =>
          !t.id ||
          !t.name ||
          !["pending", "in-progress", "completed"].includes(t.status),
      ))
  )
    throw new Error("Invalid project tasks");
  if (
    out.costs !== undefined &&
    (!Array.isArray(out.costs) || out.costs.length > 500)
  )
    throw new Error("Invalid project costs");
  if (out.tasks) validateTaskGraph(out.tasks);
  if (out.costs)
    out.costs = out.costs.map((c: Data) => ({
      ...c,
      amountMinor: moneyToMinor(c.amount),
    }));
  validateWorkflowExtras(out);
  return out;
}

export function validateTaskGraph(tasks: Data[]): void {
  const map = new Map<string, Data>();
  for (const task of tasks) {
    if (map.has(task.id)) throw new Error("Duplicate task ID");
    map.set(task.id, task);
  }
  const visited = new Set<string>(),
    path = new Set<string>();
  function visit(id: string): void {
    if (path.has(id)) throw new Error("Task dependency cycle");
    if (visited.has(id)) return;
    path.add(id);
    const task = map.get(id)!;
    const deps = task.dependencyIds || task.dependencies || [];
    if (!Array.isArray(deps)) throw new Error("Invalid task dependencies");
    for (const dependency of deps) {
      if (typeof dependency !== "string" || !map.has(dependency))
        throw new Error("Missing task dependency");
      visit(dependency);
      if (
        task.status === "completed" &&
        map.get(dependency)!.status !== "completed"
      )
        throw new Error("Complete dependencies first");
    }
    path.delete(id);
    visited.add(id);
  }
  for (const id of map.keys()) visit(id);
}

export const supportedCurrencies=['AED','USD','EUR','GBP','SAR','QAR','INR','AUD','CAD','CHF','CNY','HKD','SGD','NZD','ZAR','EGP'];



function validateWorkflowExtras(out:Data):void{
 if(out.currency!==undefined&&!supportedCurrencies.includes(out.currency))throw new Error('Unsupported two-decimal currency');
 if(out.checklist!==undefined&&(!Array.isArray(out.checklist)||out.checklist.length>100||out.checklist.some((item:any)=>typeof item!=='string'&&(!item||typeof item.id!=='string'||(typeof item.title!=='string'&&typeof item.text!=='string')||(typeof item.done!=='boolean'&&typeof item.completed!=='boolean')))))throw new Error('Invalid checklist');
 if(out.clarifications!==undefined&&(!Array.isArray(out.clarifications)||out.clarifications.length>100||out.clarifications.some((item:any)=>!item||typeof item.id!=='string'||typeof item.question!=='string'||item.answer!==undefined&&typeof item.answer!=='string')))throw new Error('Invalid clarification');
 if(out.approvalSteps!==undefined&&(!Array.isArray(out.approvalSteps)||out.approvalSteps.length>50||out.approvalSteps.some((item:any)=>!item||typeof item.id!=='string'||typeof item.label!=='string'||!['pending','approved','rejected'].includes(item.status))))throw new Error('Invalid approval step');
 if(typeof out.document==='string'&&out.document.startsWith('data:'))throw new Error('Inline document payload forbidden');
}
