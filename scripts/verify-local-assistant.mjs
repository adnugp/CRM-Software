import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
const {initializeApp,deleteApp}=require('firebase-admin/app');
const app=initializeApp({projectId:'demo-crm-test'});
try {
 const auth=require('firebase-admin/auth').getAuth(app);
 async function post(url,data,token){const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});const result=await response.json();if(result.error)throw Error(result.error.status+': '+result.error.message);return result;}
 async function signIn(email){const user=await auth.getUserByEmail(email);return (await post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo-local-api-key',{token:await auth.createCustomToken(user.uid),returnSecureToken:true})).idToken;}
 const token=await signIn(process.argv[2]);
 const call=async(name,data,t=token)=>(await post('http://127.0.0.1:5001/demo-crm-test/us-central1/'+name,{data},t)).result;
 const grow='RqVQ9MjL66qYj53qMuq7',sadeem='uIIe784mDo8wk8Whwrgp';
 let growChat;
 for(const workspaceId of [grow,sadeem]) {
  const suggestions=await call('aiSuggestions',{workspaceId});
  assert.ok(suggestions.records.projects.length);assert.ok(suggestions.records.employees.length);
  assert.ok(suggestions.records.employees.some(employee=>employee.name===(workspaceId===grow?'Sana Ahmed':'Fatima Noor')));
  assert.ok(!suggestions.records.employees.some(employee=>employee.name===(workspaceId===grow?'Fatima Noor':'Sana Ahmed')));
  const briefing=await call('aiChat',{workspaceId,message:'Show daily briefing'});
  assert.equal(briefing.mode,'quick');assert.match(briefing.response,/Daily briefing/);assert.match(briefing.response,/no AI API tokens/);assert.match(briefing.response,/Unpaid invoices/);
  const risk=await call('aiChat',{workspaceId,conversationId:briefing.conversationId,message:'Show project risks'});
  assert.equal(risk.mode,'quick');assert.match(risk.response,/Observed project concerns/);
  const history=await call('aiHistory',{workspaceId,conversationId:risk.conversationId});
  assert.equal(history.messages.length,4);assert.equal(history.messages[0].content,'Show daily briefing');assert.ok(history.messages[1].citations.length);
  const list=await call('aiHistory',{workspaceId});assert.ok(list.conversations.some(chat=>chat.id===briefing.conversationId));
  if(workspaceId===grow)growChat=risk.conversationId;
 }
 const staff=await signIn('demo.sana@crm.local');
 await assert.rejects(()=>call('aiHistory',{workspaceId:grow,conversationId:growChat},staff),/PERMISSION_DENIED/);
 await assert.rejects(()=>call('aiHistory',{workspaceId:sadeem,conversationId:growChat}),/PERMISSION_DENIED/);
 const staffSuggestions=await call('aiSuggestions',{workspaceId:grow},staff);assert.equal(staffSuggestions.records.invoices,undefined);assert.ok(staffSuggestions.records.employees.every(employee=>employee.name==='Sana Ahmed'));
 const staffBriefing=await call('aiChat',{workspaceId:grow,message:'Show daily briefing'},staff);
 assert.equal(staffBriefing.mode,'quick');assert.doesNotMatch(staffBriefing.response,/Unpaid invoices|outstanding/);
 console.log('Verified both workspace briefings, risks, actual record suggestions, persisted chat history and account/workspace/finance isolation. No hosted AI calls made.');
} finally {await deleteApp(app);}
