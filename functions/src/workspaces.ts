import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import {
  HttpsError,
  onCall,
  CallableRequest,
} from "firebase-functions/v2/https";
import { db, auth } from "./firebase";
import { authorizeContext, validId, WorkspaceContext } from "./domain";
import { Data, supportedCurrencies } from "./policy";
function uid(req: CallableRequest): string {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
  return req.auth.uid;
}
async function admin(req: CallableRequest) {
  const ctx = await authorizeContext(uid(req), req.data.workspaceId);
  if (ctx.role !== "admin")
    throw new HttpsError("permission-denied", "Administrator required");
  return ctx;
}
function text(value: any, max = 200): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new HttpsError("invalid-argument", "Invalid text");
  return value.trim();
}
function settings(input: Data): Data {
  const out: Data = {};
  for (const key of Object.keys(input))
    if (
      ![
        "name",
        "currency",
        "timezone",
        "divisions",
        "notificationSettings",
      ].includes(key)
    )
      throw new HttpsError("invalid-argument", "Unsupported workspace setting");
  if (input.name !== undefined) out.name = text(input.name);
  if (input.currency !== undefined) {
    if (!supportedCurrencies.includes(input.currency))
      throw new HttpsError("invalid-argument", "Invalid currency");
    out.currency = input.currency;
  }
  if (input.timezone !== undefined) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: input.timezone });
    } catch {
      throw new HttpsError("invalid-argument", "Invalid timezone");
    }
    out.timezone = input.timezone;
  }
  if (input.divisions !== undefined) {
    if (!Array.isArray(input.divisions) || input.divisions.length > 50)
      throw new HttpsError("invalid-argument", "Invalid divisions");
    out.divisions = input.divisions.map((d: any) =>
      typeof d === "string"
        ? { id: d.toLowerCase().replace(/[^a-z0-9]/g, "-"), name: text(d) }
        : { id: validId(d.id), name: text(d.name) },
    );
    if (
      new Set(out.divisions.map((d: any) => d.id)).size !== out.divisions.length
    )
      throw new HttpsError("invalid-argument", "Duplicate divisions");
  }
  if (input.notificationSettings !== undefined) {
    const n = input.notificationSettings;
    if (!n || typeof n !== "object")
      throw new HttpsError("invalid-argument", "Invalid notifications");
    out.notificationSettings = {
      enabled: n.enabled === true,
      daysBefore: Math.min(90, Math.max(0, Number.isFinite(Number(n.daysBefore)) ? Math.floor(Number(n.daysBefore)) : 7)),
      recipientEmails: Array.isArray(n.recipientEmails)
        ? n.recipientEmails.slice(0, 20).map((e: any) => {
            if (typeof e !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
              throw new HttpsError("invalid-argument", "Invalid recipient");
            return e;
          })
        : [],
    };
  }
  return out;
}
export const workspaceBootstrap = onCall(async (req) => {
  const userId = uid(req),
    profile = await auth.getUser(userId);
  const workspaceRef = db.collection("workspaces").doc();
  const cleaned = settings({
    name: req.data.name,
    currency: req.data.currency || "AED",
    timezone: req.data.timezone || "Asia/Dubai",
    divisions: req.data.divisions || [],
  });
  const now = new Date().toISOString();
  const b = db.batch();
  b.create(workspaceRef, {
    ...cleaned,
    createdAt: now,
    createdBy: userId,
    recordCount: 0,
    memberCount: 1,
    billing: {
      plan: "trial",
      status: "trial",
      limits: { members: 5, records: 10000, aiMessages: 100,storageBytes:1073741824 },
    },
    notificationSettings: {
      enabled: false,
      daysBefore: 7,
      recipientEmails: [],
    },
  });
  b.create(workspaceRef.collection("members").doc(userId), {
    uid: userId,
    email: profile.email || "",
    name: profile.displayName || profile.email || "",
    role: "admin",
    active: true,
    createdAt: now,
  });
  b.set(
    db.doc(`users/${userId}`),
    {
      email: profile.email || "",
      name: profile.displayName || profile.email || "",
      updatedAt: now,
    },
    { merge: true },
  );
  await b.commit();
  return { workspaceId: workspaceRef.id };
});
export const workspaceList = onCall(async (req) => {
  const userId = uid(req);
  const members = await db
    .collectionGroup("members")
    .where("uid", "==", userId)
    .where("active", "==", true)
    .get();
  const workspaces = await Promise.all(
    members.docs.map(async (m) => {
      const w = await m.ref.parent.parent!.get();
      return w.exists ? { ...w.data(), id: w.id, role: m.data().role } : null;
    }),
  );
  return { workspaces: workspaces.filter(Boolean) };
});
export const workspaceMembers = onCall(async (req) => {
  const ctx = await authorizeContext(uid(req), req.data.workspaceId);
  if (ctx.role === "client")
    throw new HttpsError("permission-denied", "Staff access required");
  const snap = await db
    .collection(`workspaces/${ctx.workspaceId}/members`)
    .get();
  return { members: snap.docs.map((d) => ({ ...d.data(), id: d.id })) };
});
export const workspaceInvite = onCall(async (req) => {
  const ctx = await admin(req);
  const email = text(req.data.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new HttpsError("invalid-argument", "Invalid email");
  const role = req.data.role;
  if (!["admin", "manager", "user", "client"].includes(role))
    throw new HttpsError("invalid-argument", "Invalid role");
  const name = text(req.data.name);
  let account;
  try {
    account = await auth.getUserByEmail(email);
  } catch (e) {
    if ((e as any).code !== "auth/user-not-found") throw e;
    const password = req.data.password || randomBytes(32).toString("base64url");
    if (typeof password !== "string" || password.length < 12)
      throw new HttpsError(
        "invalid-argument",
        "Password requires at least 12 characters",
      );
    account = await auth.createUser({ email, displayName: name, password });
  }
  const member = db.doc(`workspaces/${ctx.workspaceId}/members/${account.uid}`),
    wref = db.doc(`workspaces/${ctx.workspaceId}`),
    invite = db.collection(`workspaces/${ctx.workspaceId}/invitations`).doc();
  await db.runTransaction(async (tx) => {
    const [w, m, caller] = await Promise.all([
      tx.get(wref),
      tx.get(member),
      tx.get(db.doc(`workspaces/${ctx.workspaceId}/members/${ctx.uid}`)),
    ]);
    if (!caller.data()?.active || caller.data()?.role !== "admin")
      throw new HttpsError("permission-denied", "Administrator required");
    if (m.data()?.active)
      throw new HttpsError("already-exists", "Already a member");
    if (
      (w.data()?.memberCount || 0) >= (w.data()?.billing?.limits?.members ?? 5)
    )
      throw new HttpsError("resource-exhausted", "Member limit reached");
    const now = new Date().toISOString();
    tx.set(member, {
      uid: account.uid,
      email,
      name,
      role,
      active: true,
      createdAt: now,
      invitedBy: ctx.uid,
    });
    tx.create(invite, {
      uid: account.uid,
      email,
      role,
      status: "accepted",
      delivery: "manual",
      createdAt: now,
      createdBy: ctx.uid,
    });
    tx.update(wref, {
      lastMutationAt: new Date().toISOString(),
      memberCount: FieldValue.increment(1),
    });
    tx.create(db.collection(`workspaces/${ctx.workspaceId}/audit`).doc(), {
      actorId: ctx.uid,
      action: "member.invite",
      userId: account.uid,
      role,
      at: now,
    });
  });
  const profile = db.doc("users/" + account.uid);
  if (!(await profile.get()).exists)
    await profile.create({
      email: account.email || email,
      name: account.displayName || email,
    });
  return { uid: account.uid, invitationId: invite.id, delivery: "manual" };
});
export const workspaceRevoke = onCall(async (req) => {
  const ctx = await admin(req),
    target = validId(req.data.userId);
  if (target === ctx.uid)
    throw new HttpsError(
      "failed-precondition",
      "Administrators cannot revoke themselves",
    );
  await db.runTransaction(async (tx) => {
    const member = db.doc(`workspaces/${ctx.workspaceId}/members/${target}`);
    const [m, caller] = await Promise.all([
      tx.get(member),
      tx.get(db.doc(`workspaces/${ctx.workspaceId}/members/${ctx.uid}`)),
    ]);
    if (!caller.data()?.active || caller.data()?.role !== "admin")
      throw new HttpsError("permission-denied", "Administrator required");
    if (!m.data()?.active) return;
    tx.update(member, {
      active: false,
      revokedAt: new Date().toISOString(),
      revokedBy: ctx.uid,
    });
    tx.update(db.doc(`workspaces/${ctx.workspaceId}`), {
      lastMutationAt: new Date().toISOString(),
      memberCount: FieldValue.increment(-1),
    });
    tx.create(db.collection(`workspaces/${ctx.workspaceId}/audit`).doc(), {
      actorId: ctx.uid,
      action: "member.revoke",
      userId: target,
      at: new Date().toISOString(),
    });
  });
  return { success: true };
});
export const workspaceSettings = onCall(async (req) => {
  const ctx = await authorizeContext(uid(req), req.data.workspaceId);
  if (req.data.settings) {
    if (ctx.role !== "admin")
      throw new HttpsError("permission-denied", "Administrator required");
    const cleaned = settings(req.data.settings);
    await updateAsAdmin(ctx, cleaned, {
      action: "workspace.settings",
      fields: Object.keys(cleaned),
    });
  }
  const w = await db.doc(`workspaces/${ctx.workspaceId}`).get();
  return {
    workspace: w.data(),
    notificationSettings: w.data()?.notificationSettings,
  };
});
export const workspaceBilling = onCall(async (req) => {
  const ctx = await admin(req);
  if (!req.data.billing && !req.data.plan)
    return { billing: ctx.workspace.billing };
  if (req.auth?.token.platformAdmin !== true)
    throw new HttpsError(
      "permission-denied",
      "Platform operator required to change entitlements",
    );
  const input = req.data.billing || req.data;
  const billing: Data = {
    plan: text(input.plan || "manual", 50),
    status: input.status,
    limits: {},
  };
  if (
    !["trial", "active", "past_due", "suspended", "cancelled"].includes(
      billing.status,
    )
  )
    throw new HttpsError("invalid-argument", "Invalid billing status");
  for (const key of ["members", "records", "aiMessages"]) {
    const value = input.limits?.[key];
    if (!Number.isSafeInteger(value) || value < 0 || value > 1000000)
      throw new HttpsError("invalid-argument", "Invalid limit");
    billing.limits[key] = value;
  }
  const bytes=input.limits?.storageBytes??ctx.workspace.billing?.limits?.storageBytes??1073741824;if(!Number.isSafeInteger(bytes)||bytes<0||bytes>1099511627776)throw new HttpsError('invalid-argument','Invalid storage byte limit');billing.limits.storageBytes=bytes;
  billing.updatedAt = new Date().toISOString();
  billing.updatedBy = ctx.uid;
  await updateAsAdmin(ctx, { billing }, { action: "billing.update", billing });
  return { billing };
});

export const platformSuspend = onCall(async (req) => {
  uid(req);
  if (req.auth?.token.platformAdmin !== true)
    throw new HttpsError("permission-denied", "Platform operator required");
  const userId = validId(req.data.userId);
  if (typeof req.data.disabled !== "boolean")
    throw new HttpsError("invalid-argument", "Disabled flag required");
  if (userId === req.auth.uid)
    throw new HttpsError("failed-precondition", "Cannot suspend own account");
  await auth.updateUser(userId, { disabled: req.data.disabled });
  await auth.revokeRefreshTokens(userId);
  await db
    .doc(`users/${userId}`)
    .set({ disabled: req.data.disabled }, { merge: true });
  await db.collection("platformAudit").add({
    actorId: req.auth.uid,
    action: "account.suspend",
    userId,
    disabled: req.data.disabled,
    at: new Date().toISOString(),
  });
  return { success: true };
});

async function updateAsAdmin(
  ctx: WorkspaceContext,
  data: Data,
  event: Data,
): Promise<void> {
  await db.runTransaction(async (tx) => {
    const member = await tx.get(
      db.doc(`workspaces/${ctx.workspaceId}/members/${ctx.uid}`),
    );
    if (!member.data()?.active || member.data()?.role !== "admin")
      throw new HttpsError("permission-denied", "Administrator required");
    const at = new Date().toISOString();
    tx.update(db.doc(`workspaces/${ctx.workspaceId}`), {
      ...data,
      lastMutationAt: at,
    });
    tx.create(db.collection(`workspaces/${ctx.workspaceId}/audit`).doc(), {
      ...event,
      actorId: ctx.uid,
      at,
    });
  });
}


