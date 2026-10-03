import { createHash } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./firebase";
import { authorizeContext, validId } from "./domain";
export const recordPayment = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
  const ctx = await authorizeContext(req.auth.uid, req.data.workspaceId);
  if (!["admin", "manager"].includes(ctx.role))
    throw new HttpsError("permission-denied", "Management required");
  const { amountMinor, date, requestId } = req.data;
  const invoiceId = validId(req.data.invoiceId);
  if (
    !Number.isSafeInteger(amountMinor) ||
    amountMinor <= 0 ||
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    isNaN(Date.parse(date)) ||
    typeof requestId !== "string" ||
    requestId.length > 128
  )
    throw new HttpsError(
      "invalid-argument",
      "Valid amount, date and request ID required",
    );
  const key = createHash("sha256")
    .update(ctx.uid + ":" + requestId)
    .digest("hex");
  const requestRef = db.doc(
      `workspaces/${ctx.workspaceId}/requests/payment_${key}`,
    ),
    ref = db.doc(`workspaces/${ctx.workspaceId}/invoices/${invoiceId}`),
    receipt = db.doc(`workspaces/${ctx.workspaceId}/payments/${key}`);
  return db.runTransaction(async (tx) => {
    const [membership, invoice, request, w] = await Promise.all([
      tx.get(db.doc(`workspaces/${ctx.workspaceId}/members/${ctx.uid}`)),
      tx.get(ref),
      tx.get(requestRef),
      tx.get(db.doc(`workspaces/${ctx.workspaceId}`)),
    ]);
    if (
      !membership.data()?.active ||
      !["admin", "manager"].includes(membership.data()?.role)
    )
      throw new HttpsError("permission-denied", "Management required");
    if (request.exists) {
      if (
        request.data()?.invoiceId !== invoiceId ||
        request.data()?.amountMinor !== amountMinor ||
        request.data()?.date !== date
      )
        throw new HttpsError("already-exists", "Request ID reused");
      return request.data()!.result;
    }
    if (!["active", "trial"].includes(w.data()?.billing?.status))
      throw new HttpsError("failed-precondition", "Workspace billing inactive");
    if (!invoice.exists) throw new HttpsError("not-found", "Invoice not found");
    if (
      (w.data()?.recordCount || 0) >=
      (w.data()?.billing?.limits?.records ?? 10000)
    )
      throw new HttpsError(
        "resource-exhausted",
        "Workspace record limit reached",
      );
    const old = invoice.data()!;
    if (old.archivedAt || old.status === "cancelled")
      throw new HttpsError("failed-precondition", "Invoice unavailable");
    const total = old.amountMinor ?? old.totalMinor;
    if (
      !Number.isSafeInteger(total) ||
      (old.paidAmountMinor || 0) + amountMinor > total
    )
      throw new HttpsError(
        "invalid-argument",
        "Payment exceeds outstanding balance",
      );
    const now = new Date().toISOString(),
      paidAmountMinor = (old.paidAmountMinor || 0) + amountMinor;
    const record = {
      ...old,
      paidAmountMinor,
      status: paidAmountMinor === total ? "paid" : old.status,
      version: old.version + 1,
      updatedAt: now,
      updatedBy: ctx.uid,
    };
    tx.set(ref, record);
    tx.update(w.ref, {
      lastMutationAt: now,
      recordCount: (w.data()?.recordCount || 0) + 1,
    });
    tx.create(receipt, {
      invoiceId,
      currency:old.currency||w.data()?.currency||"AED",
      amountMinor,
      date,
      status: "paid",
      createdBy: ctx.uid,
      createdAt: now,
      updatedBy: ctx.uid,
      updatedAt: now,
      version: 1,
    });
    tx.create(db.collection(`workspaces/${ctx.workspaceId}/audit`).doc(), {
      actorId: ctx.uid,
      action: "invoice.payment",
      recordId: invoiceId,
      amountMinor,
      at: now,
    });
    const result = { id: invoiceId, record };
    tx.create(requestRef, {
      invoiceId,
      amountMinor,
      date,
      result,
      createdAt: now,
    });
    return result;
  });
});
