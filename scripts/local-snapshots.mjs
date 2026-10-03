import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readdirSync,existsSync,cpSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let exporting=false;
async function snapshot(){
 if(exporting)return;
 try{const response=await fetch('http://127.0.0.1:4400/emulators');const services=await response.json();if(!services.auth||!services.firestore||!services.storage)return;}catch{return;}
 exporting=true;
 const started=Date.now(),target=path.join(root,'.ops-private','local-emulators');
 const task=spawn(process.execPath,[require.resolve('firebase-tools/lib/bin/firebase.js'),'emulators:export',path.join(root,'.ops-private','local-emulators'),'--project','demo-crm-test','--force'],{cwd:root,windowsHide:true,stdio:'ignore'});
 await new Promise(resolve=>{task.on('exit',()=>{
  let saved=false;
  // On Windows Node may crash after a successful export. Trust only a fresh,
  // complete export, and update the import pointer even when an older exists.
  const metadata=path.join(target,'firebase-export-metadata.json');
  if(existsSync(metadata)&&statSync(metadata).mtimeMs>=started-2000){try{const destination=path.join(root,'.ops-private','snapshots',String(Date.now()));mkdirSync(path.dirname(destination),{recursive:true});cpSync(target,destination,{recursive:true});writeFileSync(path.join(root,'.ops-private','latest-snapshot.json'),JSON.stringify({path:destination}));saved=true;}catch{/* Keep last good snapshot. */}}
  // Java can keep the completed export open on Windows, preventing rename.
  // Copy a complete, freshly generated export instead; never touch user files.
  if(!saved&&process.platform==='win32'){
   const candidates=readdirSync(root).filter(name=>/^firebase-export-\d+[A-Za-z0-9]+$/.test(name)).map(name=>path.join(root,name)).filter(dir=>existsSync(path.join(dir,'firebase-export-metadata.json'))).sort((a,b)=>statSync(b).mtimeMs-statSync(a).mtimeMs);
   if(candidates[0]&&Date.now()-statSync(candidates[0]).mtimeMs<120000){try{const destination=path.join(root,'.ops-private','snapshots',String(Date.now()));mkdirSync(path.dirname(destination),{recursive:true});cpSync(candidates[0],destination,{recursive:true});writeFileSync(path.join(root,'.ops-private','latest-snapshot.json'),JSON.stringify({path:destination}));saved=true;}catch{/* Keep last good snapshot. */}}
  }
  console.log(saved?'Local emulator snapshot saved.':'Local snapshot failed; retrying next cycle.');resolve();
 });task.on('error',resolve);});exporting=false;
}
if(process.argv.includes('--once'))await snapshot();else{await snapshot();setInterval(snapshot,60000);}
