// Local-only demo normalization. Never infer ownership of user-created records.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
Object.assign(process.env,{FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'});
const {initializeApp,deleteApp}=require('firebase-admin/app');const app=initializeApp({projectId:'demo-crm-test'});
try{
 const auth=require('firebase-admin/auth').getAuth(app),user=await auth.getUserByEmail(process.argv[2]);
 async function post(url,data,token){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});const b=await r.json();if(!r.ok||b.error)throw Error(b.error?.message||'Local demo update failed');return b;}
 const token=(await post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo-local-api-key',{token:await auth.createCustomToken(user.uid),returnSecureToken:true})).idToken;
 const call=async(name,data)=>(await post('http://127.0.0.1:5001/demo-crm-test/us-central1/'+name,{data},token)).result;
 const targets=[['RqVQ9MjL66qYj53qMuq7','Grow Plus Technologies'],['uIIe784mDo8wk8Whwrgp','sadeem']];
 const workspaces=(await call('workspaceList',{})).workspaces;
 const collections=['employees','customers','contacts','projects','tenders','registrations','renewals','invoices','payments','subscriptions','partners','milestones','comments','files'];
 for(const [workspaceId,expected] of targets){
  const w=workspaces.find(x=>x.id===workspaceId&&x.name===expected&&x.role==='admin');if(!w)throw Error('Demo workspace identity changed; refusing update');
  const records={};for(const collection of collections){const rows=[];let cursor;do{const page=await call('crmList',{workspaceId,collection,pageSize:100,cursor});rows.push(...page.records);cursor=page.cursor;}while(cursor);records[collection]=rows;}
  mkdirSync('.ops-private/demo-separation',{recursive:true});writeFileSync(`.ops-private/demo-separation/${workspaceId}-${Date.now()}.json`,JSON.stringify({workspace:w,records}));
  const sadeem=expected==='sadeem',owner=sadeem?'Sadeem Energy':expected;
  await call('workspaceSettings',{workspaceId,settings:{divisions:[owner]}});
  const members=(await call('workspaceMembers',{workspaceId})).members,assignments=new Map();
  if(sadeem){for(const [oldEmail,email,name] of [['demo.sana@crm.local','demo.sadeem.fatima@crm.local','Fatima Noor'],['demo.omar@crm.local','demo.sadeem.khalid@crm.local','Khalid Mansour']]){
   const old=members.find(m=>m.email===oldEmail),existing=members.find(m=>m.email===email&&m.active!==false);
   const uid=existing?.id||(await call('workspaceInvite',{workspaceId,email,name,role:'user'})).uid;
   if(old)assignments.set(old.id,{uid,name,email});
  }}
  function assigned(value){if(Array.isArray(value))return value.map(assigned);if(value&&typeof value==='object'){const out=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,assigned(v)]));const next=assignments.get(value.assignedTo);if(next){out.assignedTo=next.uid;if('assignedToName'in value)out.assignedToName=next.name;}if(Array.isArray(value.assignedUserIds))out.assignedUserIds=value.assignedUserIds.map(id=>assignments.get(id)?.uid||id);return out;}return value;}
  let updated=0;
  for(const collection of collections)for(const record of records[collection]){
   if(!record.id.startsWith('demo_')&&record.id!=='tender_demo_tender_3')continue;
   const data={};if('belongsTo'in record)data.belongsTo=owner;
   if(record.company==='Grow Plus Technologies'||record.company==='Sadeem Energy')data.company=owner;
   const transformed=assigned(record);for(const key of ['assignedTo','assignedToName','assignedUserIds','tasks'])if(JSON.stringify(transformed[key])!==JSON.stringify(record[key]))data[key]=transformed[key];
   if(sadeem){
    if(collection==='employees'&&assignments.has(record.userId)){const next=assignments.get(record.userId);Object.assign(data,{userId:next.uid,name:next.name,email:next.email});}
    const names={projects:['Sadeem Solar Maintenance','Sadeem Battery Storage Upgrade','Sadeem Energy Monitoring','Sadeem Rooftop Installation'],tenders:['Sadeem Solar Maintenance RFQ','Sadeem Storage Expansion RFP','Sadeem Metering Retrofit','Sadeem Warehouse Lighting RFP','Sadeem Efficiency Audit'],customers:['Sadeem Commercial Facilities','Northern Solar Operations','Coastal Energy Services','Oasis Logistics'],contacts:['Amal Faris','Salim Nasser','Rania Saeed','Tariq Hamad']};
    const index=Number(record.id.match(/_(\d+)$/)?.[1]);if(names[collection]?.[index])data.name=names[collection][index];
    if(collection==='projects'&&record.id==='tender_demo_tender_3')data.name='Sadeem Warehouse Lighting';
    if(['projects','tenders'].includes(collection)){const customer=collection==='projects'?index:index%4;if(Number.isInteger(customer)&&names.customers[customer])data.company=names.customers[customer];}
    if(collection==='partners')data.name=record.id.endsWith('_0')?'Sadeem Solar Supply Demo':'Sadeem Commissioning Demo';
    if(collection==='subscriptions')data.name=record.id.endsWith('_0')?'Energy modelling licences':'Remote site monitoring';
    if(collection==='invoices')Object.assign(data,{name:'SADEEM-DEMO-'+(1001+index),invoiceNumber:'SADEEM-DEMO-'+(1001+index)});
   }
   for(const key of Object.keys(data))if(JSON.stringify(data[key])===JSON.stringify(record[key]))delete data[key];
   if(Object.keys(data).length){await call('crmMutate',{workspaceId,collection,action:'update',id:record.id,expectedVersion:record.version,data,requestId:'separate_demo_'+collection+'_'+record.id+'_'+record.version});updated++;}
  }
  if(sadeem)for(const member of members.filter(m=>['demo.sana@crm.local','demo.omar@crm.local'].includes(m.email)&&m.active!==false))await call('workspaceRevoke',{workspaceId,userId:member.id});
  console.log(JSON.stringify({workspace:w.name,updated,note:'Known demo records only; backup saved privately.'}));
 }
}finally{await deleteApp(app);}
