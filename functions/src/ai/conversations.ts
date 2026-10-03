import {getFirestore} from 'firebase-admin/firestore';
import {onCall, HttpsError} from 'firebase-functions/v2/https';
import {authorizeContext, getRecord, WorkspaceContext} from '../domain';
import {assertConversation, identifier, history, READ_COLLECTIONS} from './core';

export async function checkConversationAccess(ctx: WorkspaceContext, stored: any, read = getRecord) {
  assertConversation(stored, ctx.uid, ctx.workspaceId);
  if (!stored) throw new Error('Conversation unavailable');
  const expiresAt=typeof stored.expiresAt==='number'?stored.expiresAt:stored.expiresAt?.toMillis?.();
  if (expiresAt && expiresAt <= Date.now()) throw new Error('Conversation expired');
  if (stored.messages?.length && stored.accessRole !== ctx.role) throw new Error('Conversation unavailable after access changes. Start a new chat.');
  const sources: {collection:string;id:string}[] = stored.sources || [];
  for (let offset=0;offset<sources.length;offset+=20) {
    await Promise.all(sources.slice(offset,offset+20).map(async source=>{
      if (![...READ_COLLECTIONS,'files','payments','invoices'].includes(source.collection)) throw new Error('Conversation unavailable after record access changes.');
      const record=await read(ctx,source.collection,identifier(source.id));
      if(!record || (source.collection==='files'&&record.quarantine!=='clean'))throw new Error('Conversation unavailable after record access changes.');
    }));
  }
}

export const aiHistory = onCall(async request => {
  if (!request.auth) throw new HttpsError('unauthenticated','Sign in required');
  const ctx = await authorizeContext(request.auth.uid, identifier(request.data?.workspaceId));
  const root = getFirestore().collection('workspaces').doc(ctx.workspaceId).collection('aiConversations');
  if (request.data?.conversationId) {
    const snapshot = await root.doc(identifier(request.data.conversationId)).get();
    const stored = snapshot.data();
    try {await checkConversationAccess(ctx,stored);} catch {throw new HttpsError('permission-denied','Conversation unavailable or its record access changed.');}
    // Stored proposals are deliberately not replayed from transcript history.
    const transcript = history(stored!.messages || []).map((message,index)=>({...message, citations:stored!.transcript?.[index]?.citations || []}));
    const fresh=await authorizeContext(ctx.uid,ctx.workspaceId);
    if(fresh.role!==ctx.role)throw new HttpsError('permission-denied','Access changed. Retry.');
    return {conversationId:snapshot.id,messages:transcript};
  }
  // Single-field query avoids a required composite index. The list is bounded.
  const candidates = await root.where('uid','==',ctx.uid).limit(100).get();
  const sorted = candidates.docs.sort((a,b)=>(b.data().updatedAt?.toMillis()||0)-(a.data().updatedAt?.toMillis()||0));
  const conversations: any[] = [];
  for (const candidate of sorted) {
    if (conversations.length>=20) break;
    const stored = candidate.data();
    if (!stored.messages?.length) continue;
    try {await checkConversationAccess(ctx,stored);} catch {continue;}
    const title = stored.messages.find((m:any)=>m.role==='user')?.content || 'Conversation';
    conversations.push({id:candidate.id,title:String(title).slice(0,100),updatedAt:stored.updatedAt?.toMillis()||0});
  }
  const fresh=await authorizeContext(ctx.uid,ctx.workspaceId);
  if(fresh.role!==ctx.role)throw new HttpsError('permission-denied','Access changed. Retry.');
  return {conversations, scope:'Up to 20 available conversations from 100 stored conversations owned by this account in this workspace.'};
});
