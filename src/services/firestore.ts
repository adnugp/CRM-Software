import { callApi, requireWorkspace } from './api';
import {assertWorkspaceRecords} from '@/lib/workspace-records';
import type { Project, Tender, Employee, Registration, Payment, Subscription, Partner, FileRecord } from '@/types';

export interface BusinessRecord { id: string; version?: number; workspaceId?: string; [key: string]: unknown; }
function cleanPayload(value:unknown, depth=0):unknown {
  if(Array.isArray(value)) return value.map(entry=>cleanPayload(entry,depth+1));
  if(value instanceof Date) return value.toISOString();
  if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).filter(([key,v])=>v!==undefined && key!=='data' && (depth>0 || !['id','version','workspaceId','createdAt','createdBy','updatedAt','updatedBy','archivedAt'].includes(key))).map(([key,v])=>[key,cleanPayload(v,depth+1)]));
  return value;
}
const versions = new Map<string, number>();
const key = (workspaceId: string, collection: string, id: string) => `${workspaceId}/${collection}/${id}`;
export async function listPage<T>(collection: string, cursor?: string): Promise<{records:T[];cursor?:string}> {
  const workspaceId = requireWorkspace();
  const result = await callApi<{records:BusinessRecord[];cursor?:string}>('crmList',{workspaceId,collection,pageSize:100,cursor});
  if(requireWorkspace()!==workspaceId)throw new Error('Workspace changed. Refresh before continuing.');
  assertWorkspaceRecords(workspaceId,result.records);
  result.records.forEach(record => versions.set(key(workspaceId,collection,record.id),record.version || 1));
  if (collection === 'files') result.records = result.records.map(normalizeFile);
  return result as unknown as {records:T[];cursor?:string};
}
export async function getCollection<T>(collection: string): Promise<T[]> {
  return (await listPage<T>(collection)).records;
}
export async function mutateBusinessRecord(collection: string, action: 'create'|'update'|'archive'|'restore'|'delete', data?: unknown, id?: string, expectedVersion?: number) {
  const workspaceId = requireWorkspace();
  const result = await callApi<{id:string;record:BusinessRecord}>('crmMutate',{
    workspaceId,collection,action,id,data:cleanPayload(data),
    expectedVersion:expectedVersion ?? (id ? versions.get(key(workspaceId,collection,id)) : undefined),
    requestId:crypto.randomUUID(),
  });
  if (result.record) versions.set(key(workspaceId,collection,result.id),result.record.version || 1);
  return result;
}
const addDocument = async <T>(collection: string, data: Omit<T,'id'>) => (await mutateBusinessRecord(collection,'create',data)).id;
const updateDocument = async <T>(collection: string, id: string, data: Partial<T>) => { const version=(data as Partial<T> & {version?:number}).version; await mutateBusinessRecord(collection,'update',data,id,version); };
const archiveDocument = async (collection: string, id: string) => { await mutateBusinessRecord(collection,'archive',undefined,id); };

export const getProjects = () => getCollection<Project>('projects');
export const addProject = (data:Omit<Project,'id'>) => addDocument<Project>('projects',data);
export const updateProject = (id:string,data:Partial<Project>) => updateDocument<Project>('projects',id,data);
export const deleteProject = (id:string) => archiveDocument('projects',id);
export const getTenders = () => getCollection<Tender>('tenders');
export const addTender = (data:Omit<Tender,'id'>) => addDocument<Tender>('tenders',data);
export const updateTender = (id:string,data:Partial<Tender>) => updateDocument<Tender>('tenders',id,data);
export const deleteTender = (id:string) => archiveDocument('tenders',id);
export const getEmployees = () => getCollection<Employee>('employees');
export const addEmployee = (data:Omit<Employee,'id'>) => addDocument<Employee>('employees',data);
export const updateEmployee = (id:string,data:Partial<Employee>) => updateDocument<Employee>('employees',id,data);
export const deleteEmployee = (id:string) => archiveDocument('employees',id);
export const getRegistrations = () => getCollection<Registration>('registrations');
export const addRegistration = (data:Omit<Registration,'id'>) => addDocument<Registration>('registrations',data);
export const updateRegistration = (id:string,data:Partial<Registration>) => updateDocument<Registration>('registrations',id,data);
export const deleteRegistration = (id:string) => archiveDocument('registrations',id);
export const getPayments = () => getCollection<Payment>('payments');
export const addPayment = (data:Omit<Payment,'id'>) => addDocument<Payment>('payments',data);
export const updatePayment = (id:string,data:Partial<Payment>) => updateDocument<Payment>('payments',id,data);
export const deletePayment = (id:string) => archiveDocument('payments',id);
export const getSubscriptions = () => getCollection<Subscription>('subscriptions');
export const addSubscription = (data:Omit<Subscription,'id'>) => addDocument<Subscription>('subscriptions',data);
export const updateSubscription = (id:string,data:Partial<Subscription>) => updateDocument<Subscription>('subscriptions',id,data);
export const deleteSubscription = (id:string) => archiveDocument('subscriptions',id);
export const getPartners = () => getCollection<Partner>('partners');
export const addPartner = (data:Omit<Partner,'id'>) => addDocument<Partner>('partners',data);
export const updatePartner = (id:string,data:Partial<Partner>) => updateDocument<Partner>('partners',id,data);
export const deletePartner = (id:string) => archiveDocument('partners',id);
function normalizeFile(record:BusinessRecord):BusinessRecord {
 const file=record as unknown as FileRecord & {storagePath?:string;mimeType?:string;size?:number;currentVersionId?:string;quarantine?:'pending'|'clean'|'blocked'|'rejected'};
 const document={name:file.name,size:file.size||0,type:file.mimeType||'',data:'',storagePath:file.storagePath,fileId:file.id,versionId:file.currentVersionId,quarantine:file.quarantine};
 return {...file,category:file.category||'Other',company:file.company||'',uploadedAt:file.uploadedAt||String(file.createdAt||'').slice(0,10),uploadedBy:file.uploadedBy||file.createdBy||'',document,documents:[document]} as unknown as BusinessRecord;
}
export const getFiles = () => getCollection<FileRecord>('files');
export const addFile = (data:Omit<FileRecord,'id'>) => addDocument<FileRecord>('files',data);
export const updateFile = (id:string,data:Partial<FileRecord>) => updateDocument<FileRecord>('files',id,data);
export const deleteFile = (id:string) => archiveDocument('files',id);
