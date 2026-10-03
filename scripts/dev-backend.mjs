import {spawn,spawnSync} from 'node:child_process';
import {existsSync,readdirSync,mkdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const groq=process.argv.includes('--groq');
const env={...process.env,AI_PROVIDER:process.env.AI_PROVIDER||'ollama'};
if(groq){
 const {parseEnv}=await import('node:util');
 const configPath=path.join(root,'functions','.env.local');
 const secretPath=path.join(root,'functions','.secret.local');
 if(!existsSync(configPath)||!existsSync(secretPath))throw new Error('Copy the Groq templates into functions/.env.local and functions/.secret.local, then add your key privately. See docs/AI-PROVIDERS.md.');
 const config=parseEnv(readFileSync(configPath,'utf8'));
 const secrets=parseEnv(readFileSync(secretPath,'utf8'));
 if(config.AI_PROVIDER!=='hosted'||config.AI_ENDPOINT!=='https://api.groq.com/openai/v1/chat/completions'||!config.AI_MODEL?.trim()||!secrets.AI_API_KEY?.trim()||secrets.AI_API_KEY==='YOUR_GROQ_KEY')throw new Error('Groq configuration is incomplete. Set a model and real key in the private backend files.');
 // Firebase loads .secret.local itself; do not copy secrets into the Vite environment.
 Object.assign(env,{AI_PROVIDER:config.AI_PROVIDER,AI_MODEL:config.AI_MODEL,AI_ENDPOINT:config.AI_ENDPOINT});
 console.log('Groq hosted chat enabled. Authorized CRM context will be sent to Groq.');
}
// This launcher always runs isolated demo services; it never starts a real project.
if(!env.JAVA_HOME&&process.platform==='win32'&&env.LOCALAPPDATA){
 const runtimes=path.join(env.LOCALAPPDATA,'CodexTooling','java21');
 if(existsSync(runtimes))env.JAVA_HOME=readdirSync(runtimes).map(name=>path.join(runtimes,name)).find(dir=>existsSync(path.join(dir,'bin','java.exe')));
}
if(env.JAVA_HOME)env.PATH=path.join(env.JAVA_HOME,'bin')+path.delimiter+(env.PATH||env.Path||'');
if(spawnSync('java',['-version'],{env,windowsHide:true}).error){throw new Error('Java 21 is required. Set JAVA_HOME to your Java installation, then retry npm run dev:backend.');}
const build=spawnSync(process.execPath,[require.resolve('typescript/bin/tsc')],{cwd:path.join(root,'functions'),env,stdio:'inherit',windowsHide:true});
if(build.status!==0)process.exit(build.status||1);
const state=path.join(root,'.ops-private','local-emulators');mkdirSync(path.dirname(state),{recursive:true});
const args=['emulators:start','--project','demo-crm-test','--only','auth,firestore,storage,functions','--export-on-exit',state];
const pointer=path.join(root,'.ops-private','latest-snapshot.json');let imported=state;
if(existsSync(pointer)){const candidate=path.resolve(JSON.parse(readFileSync(pointer,'utf8')).path);if(candidate.startsWith(path.join(root,'.ops-private')+path.sep))imported=candidate;}
if(existsSync(path.join(imported,'firebase-export-metadata.json')))args.push('--import',imported);
console.log('Local Firebase demo-crm-test: Auth 9099, Firestore 8081, Storage 9199, Functions 5001.');
const backend=spawn(process.execPath,[require.resolve('firebase-tools/lib/bin/firebase.js'),...args],{cwd:root,env,stdio:'inherit',windowsHide:true});
const snapshots=spawn(process.execPath,[path.join(root,'scripts','local-snapshots.mjs')],{cwd:root,env,stdio:'inherit',windowsHide:true});
let frontend;
if(process.argv.includes('--with-frontend')){
 const local={...env,VITE_USE_EMULATORS:'true',VITE_FIREBASE_PROJECT_ID:'demo-crm-test',VITE_FIREBASE_API_KEY:'demo-local-api-key',VITE_FIREBASE_AUTH_DOMAIN:'demo-crm-test.firebaseapp.com',VITE_FIREBASE_STORAGE_BUCKET:'demo-crm-test.appspot.com',VITE_FIREBASE_APP_ID:'1:1234567890:web:localcrm',VITE_FUNCTIONS_REGION:'us-central1'};
 const viteBin=path.join(path.dirname(require.resolve('vite/package.json')),'bin','vite.js');
 frontend=spawn(process.execPath,[viteBin,'--host','127.0.0.1','--port','8080','--strictPort'],{cwd:root,env:local,stdio:'inherit',windowsHide:true});
 frontend.on('exit',()=>backend.kill('SIGINT'));
}
process.on('SIGINT',()=>{frontend?.kill('SIGINT');backend.kill('SIGINT');});
process.on('SIGTERM',()=>{frontend?.kill('SIGTERM');backend.kill('SIGINT');});
backend.on('exit',code=>{snapshots.kill('SIGTERM');frontend?.kill('SIGTERM');process.exitCode=code||0;});
