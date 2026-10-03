// Explicit live verification: consumes hosted provider quota, emulator data only.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
const {initializeApp,deleteApp}=require('firebase-admin/app');
const app=initializeApp({projectId:'demo-crm-test'});
try{
 const auth=require('firebase-admin/auth').getAuth(app);
 async function post(url,data,token){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});const b=await r.json();if(!r.ok||b.error)throw Error(b.error?.message||'Local verification failed');return b;}
 const user=await auth.getUserByEmail(process.argv[2]);
 const token=(await post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo-local-api-key',{token:await auth.createCustomToken(user.uid),returnSecureToken:true})).idToken;
 const call=async(name,data)=>(await post('http://127.0.0.1:5001/demo-crm-test/us-central1/'+name,{data},token)).result;
 const workspaces=(await call('workspaceList',{})).workspaces;
 assert.equal(workspaces.length,2);
 for(const workspace of workspaces){
  const status=await call('aiStatus',{workspaceId:workspace.id});assert.equal(status.mode,'model');assert.equal(status.ready,true);
  const projects=await call('crmList',{workspaceId:workspace.id,collection:'projects',pageSize:100});assert.ok(projects.records.some(r=>r.id==='demo_project_0'));
  if(process.argv.includes('--task-only'))continue;
  const reply=await call('aiChat',{workspaceId:workspace.id,message:'Use summarizeFinance for invoices. What is the outstanding amount in AED? Report only the verified balance.'});
  assert.equal(reply.mode,'model');assert.ok(reply.citations.some(c=>c.collection==='invoices'));assert.match(reply.response,/122[,. ]?000/);
  console.log(JSON.stringify({workspace:workspace.name,mode:reply.mode,invoiceSources:reply.citations.length,answer:reply.response}));
 }
 const reply=await call('aiChat',{workspaceId:workspaces[0].id,message:'Search the exact project Palm Tower HVAC Upgrade and employee Sana Ahmed, then propose a task named Groq connection review assigned to Sana Ahmed due 2026-10-05. Do not execute it.'});
 assert.equal(reply.mode,'model');assert.ok(reply.proposal?.id);assert.equal(reply.proposal.preview?.taskName,'Groq connection review');
 console.log('Groq task proposal verified; no task was executed.');
}finally{await deleteApp(app);}
