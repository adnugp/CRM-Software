import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {authorizeContext,listRecords} from '../domain';
import {identifier} from './core';

export const aiSuggestions = onCall(async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Sign in required');
  const ctx=await authorizeContext(request.auth.uid,identifier(request.data?.workspaceId));
  const result: Record<string,any> = {};
  const collections=['projects','tenders','files','employees','customers',...(['admin','manager'].includes(ctx.role)?['invoices']:[])];
  for(const collection of collections){
    const page=await listRecords(ctx,collection,{pageSize:50});
    result[collection]=page.records.filter(r=>(collection!=='files'||r.quarantine==='clean')&&(collection!=='employees'||ctx.role!=='user'||r.userId===ctx.uid)).slice(0,12).map(r=>({id:r.id,name:String(r.name||r.invoiceNumber||r.title||r.id).slice(0,200)}));
  }
  const fresh=await authorizeContext(ctx.uid,ctx.workspaceId);
  if(fresh.role!==ctx.role)throw new HttpsError('permission-denied','Access changed. Retry.');
  return {records:result,scope:'Suggestions from the first 50 authorized records per collection; up to 12 shown.'};
});
