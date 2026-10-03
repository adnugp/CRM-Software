import { onSchedule } from "firebase-functions/v2/scheduler";
import nodemailer from "nodemailer";
import { db } from "./firebase";
async function* workspaces() {
  let cursor: string | undefined;
  while (true) {
    let q = db.collection("workspaces").orderBy("__name__").limit(100);
    if (cursor) q = q.startAfter(cursor);
    const page = await q.get();
    for (const doc of page.docs) yield doc;
    if (page.size < 100) return;
    cursor = page.docs[page.size - 1].id;
  }
}
function localClock(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
  };
}
/** Retry outbox at most three times; SMTP absent never counts as successful delivery. */
export const scheduledAlerts = onSchedule(
  {
    schedule: "0 * * * *",
    timeZone: "UTC",
    retryCount: 0,
    timeoutSeconds: 540,
    secrets: ["SMTP_PASSWORD"],
  },
  async () => {
    const configured = !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD &&
      process.env.SMTP_FROM
    );
    const transport = configured
      ? nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_PORT === "465",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        })
      : null;
    for await (const workspace of workspaces()) {
      const w = workspace.data(),
        prefs = w.notificationSettings;
      if (
        !prefs?.enabled ||
        !["trial", "active"].includes(w.billing?.status) ||
        w.lifecycle?.status === "deleting"
      )
        continue;
      const local = localClock(w.timezone || "UTC");
      if (local.hour < 9) continue;
      const horizon = new Date(
        Date.parse(local.date + "T00:00:00Z") +
          Math.min(90, prefs.daysBefore ?? 7) * 86400000,
      )
        .toISOString()
        .slice(0, 10);
      const items: Array<{ name: string; due: string; collection: string }> =
        [];
      for (const collection of [
        "registrations",
        "renewals",
        "projects",
        "tenders",
        "payments",
        "subscriptions",
      ]) {
        let cursor: string | undefined;
        while (true) {
          let query = workspace.ref
            .collection(collection)
            .orderBy("__name__")
            .limit(200);
          if (cursor) query = query.startAfter(cursor);
          const records = await query.get();
          for (const record of records.docs) {
            const r = record.data();
            if (r.archivedAt) continue;
            const due =
              r.expiryDate || r.dueDate || r.deadline || r.nextBillingDate;
            if (
              ![
                "completed",
                "paid",
                "cancelled",
                "handed-over",
                "awarded",
              ].includes(r.status) &&
              typeof due === "string" &&
              due <= horizon
            )
              items.push({
                name: r.name || r.description || record.id,
                due,
                collection,
              });
            if (collection === "projects")
              for (const task of r.tasks || [])
                if (
                  task.status !== "completed" &&
                  task.dueDate &&
                  task.dueDate <= horizon
                )
                  items.push({
                    name: task.name,
                    due: task.dueDate,
                    collection: "project tasks",
                  });
          }
          if (records.size < 200) break;
          cursor = records.docs[records.size - 1].id;
        }
      }
      if (!items.length) continue;
      const history = workspace.ref
        .collection("notificationHistory")
        .doc(local.date);
      let claimed = false;
      await db.runTransaction(async (tx) => {
        const prior = (await tx.get(history)).data();
        if (
          prior?.status === "sent" ||
          (prior?.attempts || 0) >= 3 ||
          (prior?.status === "sending" && prior.leaseUntil > Date.now())
        )
          return;
        const now = new Date().toISOString();
        if (!configured || !prefs.recipientEmails?.length) {
          tx.set(history, {
            createdAt: prior?.createdAt || now,
            items,
            status: configured ? "no_recipients" : "smtp_not_configured",
            attempts: prior?.attempts || 0,
            recipientCount: prefs.recipientEmails?.length || 0,
          });
          return;
        }
        tx.set(history, {
          createdAt: prior?.createdAt || now,
          items,
          status: "sending",
          attempts: (prior?.attempts || 0) + 1,
          leaseUntil: Date.now() + 600000,
          recipientCount: prefs.recipientEmails.length,
        });
        claimed = true;
      });
      if (!claimed || !transport) continue;
      try {
        await transport.sendMail({
          from: process.env.SMTP_FROM,
          to: prefs.recipientEmails.join(","),
          subject: `${w.name}: upcoming deadlines`,
          text: items
            .map((i) => `${i.collection}: ${i.name} — ${i.due}`)
            .join("\n"),
        });
        await history.update({
          status: "sent",
          sentAt: new Date().toISOString(),
          leaseUntil: 0,
        });
      } catch {
        await history.update({
          status: "failed",
          failedAt: new Date().toISOString(),
          leaseUntil: 0,
        });
      }
    }
  },
);
export const deriveRecordStatuses = onSchedule(
  { schedule: "0 * * * *", timeZone: "UTC", timeoutSeconds: 540 },
  async () => {
    for await (const workspace of workspaces()) {
      if (workspace.data().lifecycle?.status === "deleting") continue;
      const today = localClock(workspace.data().timezone || "UTC").date;
      for (const collection of [
        "registrations",
        "payments",
        "invoices",
        "projects",
      ]) {
        let cursor: string | undefined;
        while (true) {
          let q = workspace.ref
            .collection(collection)
            .orderBy("__name__")
            .limit(200);
          if (cursor) q = q.startAfter(cursor);
          const page = await q.get();
          for (const snapshot of page.docs) {
            await db.runTransaction(async (tx) => {
              const fresh = await tx.get(snapshot.ref),
                r = fresh.data();
              if (!r || r.archivedAt) return;
              let status: string | undefined;
              if (
                collection === "registrations" &&
                r.status === "active" &&
                r.expiryDate &&
                r.expiryDate < today
              )
                status = "expired";
              if (
                collection === "payments" &&
                r.status === "pending" &&
                r.dueDate &&
                r.dueDate < today
              )
                status = "overdue";
              if (
                collection === "invoices" &&
                ["issued", "sent"].includes(r.status) &&
                r.dueDate &&
                r.dueDate < today
              )
                status = "overdue";
              const tasks =
                collection === "projects"
                  ? (r.tasks || []).map((task: any) => ({
                      ...task,
                      derivedStatus:
                        task.status !== "completed" &&
                        task.dueDate &&
                        task.dueDate < today
                          ? "overdue"
                          : null,
                    }))
                  : undefined;
              const tasksChanged =
                tasks &&
                JSON.stringify(tasks) !== JSON.stringify(r.tasks || []);
              if (!status && !tasksChanged) return;
              const at = new Date().toISOString();
              tx.update(workspace.ref, {
                lastMutationAt: new Date().toISOString(),
              });
              tx.update(snapshot.ref, {
                ...(status ? { status } : {}),
                ...(tasksChanged ? { tasks } : {}),
                version: (r.version || 0) + 1,
                updatedAt: at,
                updatedBy: "system",
              });
              tx.create(workspace.ref.collection("audit").doc(), {
                actorId: "system",
                action: "status.derive",
                collection,
                recordId: snapshot.id,
                from: r.status,
                to: status || r.status,
                at,
              });
            });
          }
          if (page.size < 200) break;
          cursor = page.docs[page.size - 1].id;
        }
      }
    }
  },
);
