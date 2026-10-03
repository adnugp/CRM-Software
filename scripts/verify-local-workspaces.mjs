import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';const {initializeApp,deleteApp}=require('firebase-admin/app');const app=initializeApp({projectId:'demo-crm-test'});
try{
 const auth=require('firebase-admin/auth').getAuth(app);
 async function post(url,data,token){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});const b=await r.json();if(b.error)throw Error(b.error.status);return b;}
 async function signIn(email){const u=await auth.getUserByEmail(email);return (await post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo-local-api-key',{token:await auth.createCustomToken(u.uid),returnSecureToken:true})).idToken;}
 const token=await signIn(process.argv[2]);const call=async(name,data,t=token)=>(await post('http://127.0.0.1:5001/demo-crm-test/us-central1/'+name,{data},t)).result;
 const grow='RqVQ9MjL66qYj53qMuq7',sadeem='uIIe784mDo8wk8Whwrgp';const employees=[];
 for(const workspaceId of [grow,sadeem]){
  for(const collection of ['tenders','registrations','payments','subscriptions','partners','files','customers','contacts','invoices','milestones','comments','renewals']){
   const data=(await call('crmList',{workspaceId,collection,pageSize:100})).records;
   assert.ok(data.every(row=>row.workspaceId===workspaceId),`${collection} has a foreign or missing workspace ID`);
  }
  const rows=(await call('crmList',{workspaceId,collection:'employees',pageSize:100})).records;
  assert.ok(rows.every(row=>row.workspaceId===workspaceId));employees.push(rows.map(row=>row.name));
  const projects=(await call('crmList',{workspaceId,collection:'projects',pageSize:100})).records.filter(row=>row.id.startsWith('demo_')||row.id==='tender_demo_tender_3');
  assert.ok(projects.every(row=>row.workspaceId===workspaceId&&row.belongsTo===(workspaceId===grow?'Grow Plus Technologies':'Sadeem Energy')));
 }
 assert.ok(employees[0].includes('Sana Ahmed'));assert.ok(!employees[0].includes('Fatima Noor'));assert.ok(employees[1].includes('Fatima Noor'));assert.ok(!employees[1].includes('Sana Ahmed'));
 const staffToken=await signIn('demo.sana@crm.local');
 await call('crmList',{workspaceId:grow,collection:'projects'},staffToken);
 await assert.rejects(()=>call('crmList',{workspaceId:sadeem,collection:'projects'},staffToken),/PERMISSION_DENIED/);
 console.log('Distinct employee/project demo datasets verified; Grow Plus-only staff cannot read Sadeem.');
}finally{await deleteApp(app);}
