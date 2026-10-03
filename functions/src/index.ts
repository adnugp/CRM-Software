import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { authorizeContext, listRecords, mutateRecord } from "./domain";
setGlobalOptions({ maxInstances: 10, region: "us-central1" });
export * from "./workspaces";
export const crmList = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
  const ctx = await authorizeContext(req.auth.uid, req.data.workspaceId);
  return listRecords(ctx, req.data.collection, req.data);
});
export const crmMutate = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
  const ctx = await authorizeContext(req.auth.uid, req.data.workspaceId);
  return mutateRecord(ctx, req.data);
});
export { aiChat, aiConfirm, aiStatus, aiHistory, aiSuggestions } from "./ai";
export { recordPayment } from "./billing";
export { scheduledAlerts } from "./notifications";
export { aiIndexDocument } from "./ai";
export { fileDownload, documentUploadStart } from "./documents";
export { documentScan } from "./ai";
export {
  workspaceExport,
  workspaceDelete,
  purgeDeletedWorkspaces,
} from "./lifecycle";
export { workspaceExportStatus, processWorkspaceExports } from "./lifecycle";
export { deriveRecordStatuses } from "./notifications";
export { retainAuditHistory } from "./lifecycle";
export { cleanupAiRetention } from "./ai";
export {purgeDeletedDocuments} from "./documents";
