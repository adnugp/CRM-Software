const test=require('node:test');
const assert=require('node:assert/strict');
// Actual browser SDK and callable HTTP middleware against explicit demo emulators.
test('browser SDK creates and fetches a workspace through authenticated HTTP',{skip:!process.env.RUN_LOCAL_ONBOARDING_HTTP},async()=>{
 process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8081';process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
 const {initializeApp,deleteApp}=require('firebase/app');
 const {getAuth,connectAuthEmulator,createUserWithEmailAndPassword}=require('firebase/auth');
 const {getFunctions,connectFunctionsEmulator,httpsCallable}=require('firebase/functions');
 const app=initializeApp({projectId:'demo-crm-test',apiKey:'demo-local-api-key',appId:'1:1234567890:web:localcrm'},'onboarding-'+Date.now());
 const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
 const functions=getFunctions(app,'us-central1');connectFunctionsEmulator(functions,'127.0.0.1',5001);
 const adminApp=require('firebase-admin/app').initializeApp({projectId:'demo-crm-test'},'onboarding-cleanup-'+Date.now());
 let uid,workspaceId;
 try{
  const account=await createUserWithEmailAndPassword(auth,`onboarding-${Date.now()}@example.test`,'local-test-password-123');uid=account.user.uid;
  const created=await httpsCallable(functions,'workspaceBootstrap')({name:'HTTP Onboarding Test',currency:'AED',timezone:'Asia/Dubai',divisions:['Grow Plus Technologies','Sadeem Energy']});workspaceId=created.data.workspaceId;
  assert.ok(workspaceId);
  const fetched=await httpsCallable(functions,'workspaceList')({});
  assert.equal(fetched.data.workspaces.find(w=>w.id===workspaceId).role,'admin');
  assert.equal(fetched.data.workspaces.find(w=>w.id===workspaceId).name,'HTTP Onboarding Test');
  const members=await httpsCallable(functions,'workspaceMembers')({workspaceId});assert.equal(members.data.members[0].uid,uid);
 }finally{
  const db=require('firebase-admin/firestore').getFirestore(adminApp);
  if(workspaceId)await db.recursiveDelete(db.doc(`workspaces/${workspaceId}`));
  if(uid){await db.doc(`users/${uid}`).delete();await require('firebase-admin/auth').getAuth(adminApp).deleteUser(uid);}
  await deleteApp(app);await require('firebase-admin/app').deleteApp(adminApp);
 }
});
