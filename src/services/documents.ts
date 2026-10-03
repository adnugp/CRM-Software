import {ref,uploadBytesResumable} from 'firebase/storage';
import {auth} from './auth';
import {storage} from './firebase';
import {callApi,requireWorkspace} from './api';
import type {DocumentFile} from '@/types';

export async function uploadDocument(file:File,onProgress?:(progress:number)=>void,parent?:{recordCollection:string;recordId:string},fileId?:string):Promise<DocumentFile>{
 const workspaceId=requireWorkspace(); const uid=auth.currentUser?.uid;
 const ensureScope=()=>{if(requireWorkspace()!==workspaceId||auth.currentUser?.uid!==uid)throw new Error('Workspace changed. Reopen the document before continuing.');};
 if(file.size>20*1024*1024)throw new Error('Documents must be 20 MB or smaller.');
 const reservation=await callApi<{fileId:string;versionId:string;storagePath:string}>('documentUploadStart',{workspaceId,name:file.name,mimeType:file.type,size:file.size,...parent,fileId});
 ensureScope();
 const task=uploadBytesResumable(ref(storage,reservation.storagePath),file,{contentType:file.type});
 await new Promise<void>((resolve,reject)=>task.on('state_changed',snapshot=>onProgress?.(Math.round(snapshot.bytesTransferred/snapshot.totalBytes*100)),reject,()=>resolve()));
 ensureScope();
 return {name:file.name,size:file.size,type:file.type,data:'',storagePath:reservation.storagePath,fileId:reservation.fileId,versionId:reservation.versionId,quarantine:'pending'};
}
export async function downloadDocument(document:DocumentFile):Promise<void>{
 if(!document.fileId)throw new Error('This legacy document must be migrated before downloading.');
 const result=await callApi<{url:string}>('fileDownload',{workspaceId:requireWorkspace(),fileId:document.fileId,versionId:document.versionId});
 const link=window.document.createElement('a');link.href=result.url;link.download=document.name;link.rel='noopener';link.target='_blank';link.click();
}
export async function scanDocument(fileId:string){return callApi<{fileId:string;quarantine:'clean'|'rejected'}>('documentScan',{workspaceId:requireWorkspace(),fileId});}
export async function indexDocument(fileId:string){return callApi('aiIndexDocument',{workspaceId:requireWorkspace(),fileId});}
