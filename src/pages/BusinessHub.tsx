import MultiDocumentUpload from '@/components/ui/MultiDocumentUpload';
import type {DocumentFile} from '@/types';
import { useCallback, useEffect, useState, useRef } from 'react';
import {useSearchParams} from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { callApi, requireWorkspace } from '@/services/api';
import { getCollection, mutateBusinessRecord, BusinessRecord } from '@/services/firestore';
import { previewCsvImport, exportCsv, importErrorsCsv, groupMoneyByCurrency } from '@/lib/import-export';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const fields:Record<string,{name:string;label:string;type?:string;required?:boolean}[]>={
  customers:[{name:'name',label:'Company name',required:true},{name:'email',label:'Email',type:'email'},{name:'phone',label:'Phone'},{name:'notes',label:'Notes'}],
  contacts:[{name:'name',label:'Contact name',required:true},{name:'customerId',label:'Customer ID',required:true},{name:'email',label:'Email',type:'email'},{name:'phone',label:'Phone'},{name:'notes',label:'Communication notes'}],
  invoices:[{name:'name',label:'Invoice reference',required:true},{name:'customerId',label:'Customer ID',required:true},{name:'projectId',label:'Project ID',required:true},{name:'amount',label:'Invoice amount',type:'number',required:true},{name:'dueDate',label:'Due date',type:'date',required:true}],
  renewals:[{name:'name',label:'Renewal name',required:true},{name:'registrationId',label:'Registration ID',required:true},{name:'dueDate',label:'Renewal due date',type:'date',required:true},{name:'assignedTo',label:'Assignee ID',required:true}],
};
function download(text:string,name:string,type='text/csv') {
  const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
export default function BusinessHub() {
  const {activeWorkspace,user} = useAuth();
  const [searchParams]=useSearchParams();
  const finance=user?.role==='admin'||user?.role==='manager';
  const sourceTab=searchParams.get('tab');
  const {projects,tenders,payments,registrations} = useData();
  const [tab,setTab]=useState(()=>sourceTab&&['customers','contacts','renewals',...(finance?['invoices']:[])].includes(sourceTab)?sourceTab:'customers');
  const [records,setRecords]=useState<BusinessRecord[]>([]);
  const [draft,setDraft]=useState<Record<string,string>>({});
  const [edit,setEdit]=useState<BusinessRecord>();
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [csv,setCsv]=useState('');
  const [cursor,setCursor]=useState<string>();
  useEffect(()=>{if(sourceTab&&['customers','contacts','renewals',...(finance?['invoices']:[])].includes(sourceTab))setTab(sourceTab);},[sourceTab,finance]);
  const visibleTabs=finance?['customers','contacts','invoices','renewals','reports','activity','archive']:['customers','contacts','renewals','reports'];
  const collection=tab==='activity'?'auditEvents':tab;
  const scope=`${activeWorkspace?.id}/${user?.id}/${tab}`;const scopeRef=useRef(scope);scopeRef.current=scope;
  const load=useCallback(async()=>{
    const requestScope=scopeRef.current;
    setRecords([]);setCursor(undefined);setError('');
    if(!activeWorkspace||tab==='reports'||tab==='archive')return;
    setBusy(true);
    try{const result=await callApi<{records:BusinessRecord[];cursor?:string}>('crmList',{workspaceId:activeWorkspace.id,collection,pageSize:50});if(scopeRef.current!==requestScope)return;setRecords(result.records);setCursor(result.cursor);}
    catch(e){if(scopeRef.current===requestScope)setError(e instanceof Error?e.message:'Unable to load records');}finally{if(scopeRef.current===requestScope)setBusy(false);}
  },[activeWorkspace,collection,tab]);
  useEffect(()=>{setDraft({});setEdit(undefined);setCsv('');load();},[load]);
  const schema=Object.fromEntries((fields[tab]||[]).map(field=>[field.name,{required:field.required,validate:field.type==='number'?(value:string)=>Number.isFinite(Number(value))&&Number(value)>0?undefined:'Enter a positive amount':undefined}]));
  const preview=csv?previewCsvImport(csv,schema):null;
  async function save(e:React.FormEvent) {
    e.preventDefault();setBusy(true);setError('');
    try{
      const data:Record<string,unknown>={...draft};
      if(tab==='invoices'){data.amountMinor=Math.round(Number(draft.amount)*100);delete data.amount;data.currency=activeWorkspace?.currency;data.status=edit?.status||'draft';if(!edit)data.paidAmountMinor=0;}
      if(tab==='renewals')data.status=edit?.status||'pending';
      await mutateBusinessRecord(tab,edit?'update':'create',data,edit?.id,edit?.version);setDraft({});setEdit(undefined);await load();
    }catch(e){setError(e instanceof Error?e.message:'Unable to save record');}finally{setBusy(false);}
  }
  async function importRows(){
    if(!preview?.records.length||preview.errors.length)return;
    const importWorkspace=activeWorkspace?.id;
    setBusy(true);setError('');let completed=0;
    try{for(const record of preview.records){if(requireWorkspace()!==importWorkspace)throw new Error('Workspace changed. Import stopped.');const data:Record<string,unknown>={...record};if(tab==='invoices'){data.amountMinor=Math.round(Number(record.amount)*100);delete data.amount;Object.assign(data,{currency:activeWorkspace?.currency,status:'draft',paidAmountMinor:0});}if(tab==='renewals')data.status='pending';await mutateBusinessRecord(tab,'create',data);completed++;}setCsv('');await load();}
    catch(e){setError(`${completed} rows imported. Remaining rows were not imported: ${e instanceof Error?e.message:'Request failed'}`);}
    finally{setBusy(false);}
  }
  async function payment(record:BusinessRecord){
    const amount=window.prompt(`Payment amount (${record.currency || activeWorkspace?.currency})`);if(!amount)return;
    if(!Number.isFinite(Number(amount))||Number(amount)<=0){setError('Enter a positive payment amount.');return;}
    setBusy(true);setError('');
    try{await callApi('recordPayment',{workspaceId:activeWorkspace?.id,invoiceId:record.id,amountMinor:Math.round(Number(amount)*100),date:new Date().toISOString().slice(0,10),requestId:crypto.randomUUID()});await load();}
    catch(e){setError(e instanceof Error?e.message:'Unable to record payment');}finally{setBusy(false);}
  }
  async function archive(record:BusinessRecord){if(!window.confirm(`Archive ${record.name || record.id}?`))return;try{await mutateBusinessRecord(tab,'archive',undefined,record.id,record.version);await load();}catch(e){setError(e instanceof Error?e.message:'Unable to archive');}}
  async function loadArchive(name:string){setBusy(true);try{const result=await callApi<{records:BusinessRecord[]}>('crmList',{workspaceId:activeWorkspace?.id,collection:name,includeArchived:true,pageSize:100});setRecords(result.records.filter(r=>r.archivedAt).map(r=>({...r,collection:name})));}catch(e){setError(e instanceof Error?e.message:'Unable to load archive');}finally{setBusy(false);}}
  const currencies=groupMoneyByCurrency(payments.map(p=>({amount:p.amountMinor!=null?p.amountMinor/100:p.amount,currency:p.currency||activeWorkspace?.currency})));
  const deadlines=[...projects.map(p=>({name:p.name,date:p.deadline,kind:'Project'})),...tenders.map(t=>({name:t.name,date:t.deadline,kind:'Tender'})),...registrations.map(r=>({name:r.name,date:r.expiryDate,kind:'Registration'}))].filter(item=>item.date>=new Date().toISOString().slice(0,10)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,20);
  return <MainLayout><PageHeader title="Business operations" description="Manage customers, billing, renewals, and activity across your workspace."/>
    <Tabs value={tab} onValueChange={setTab}><TabsList className="flex flex-wrap h-auto justify-start mb-5">{visibleTabs.map(name=><TabsTrigger key={name} value={name}>{name.charAt(0).toUpperCase()+name.slice(1)}</TabsTrigger>)}</TabsList>
    {error&&<p className="text-destructive border p-3 rounded mb-4" role="alert">{error}</p>}
    {visibleTabs.map(name=><TabsContent key={name} value={name}>
      {fields[name]&&<div className="grid xl:grid-cols-[320px_1fr] gap-6"><Card><CardHeader><CardTitle>{edit?'Edit':'Add'} {name.slice(0,-1)}</CardTitle></CardHeader><CardContent>{!finance&&['customers','contacts'].includes(name)?<p className="text-sm text-muted-foreground">Managers maintain the customer directory.</p>:<form onSubmit={save} className="space-y-4">{fields[name].map(field=><div key={field.name}><Label htmlFor={`field-${field.name}`}>{field.label}</Label><Input id={`field-${field.name}`} type={field.type||'text'} min={field.type==='number'?'0.01':undefined} step={field.type==='number'?'0.01':undefined} required={field.required} value={draft[field.name]||''} onChange={e=>setDraft(previous=>({...previous,[field.name]:e.target.value}))}/></div>)}<Button type="submit" disabled={busy}>Save {name.slice(0,-1)}</Button>{edit&&<Button variant="ghost" onClick={()=>{setEdit(undefined);setDraft({});}}>Cancel</Button>}</form>}</CardContent></Card>
      <div className="space-y-4"><div className="flex justify-between"><p className="text-muted-foreground">{records.length} loaded records</p><Button variant="outline" onClick={()=>download(exportCsv(records,['id',...fields[name].map(f=>f.name),'currency','amountMinor','paidAmountMinor','status']),`${name}.csv`)}>Export loaded records</Button></div>
      {records.map(record=><Card key={record.id}><CardContent className="p-4"><div className="flex justify-between gap-3"><div><h3 className="font-semibold">{String(record.name||record.id)}</h3><p className="text-xs text-muted-foreground select-all">{record.id}</p>{name==='invoices'&&<p className="mt-2">{String(record.currency)} {((Number(record.amountMinor||0)-Number(record.paidAmountMinor||0))/100).toFixed(2)} outstanding · {String(record.status)}</p>}<p className="text-sm mt-1">{String(record.email||record.notes||record.dueDate||'')}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>{setEdit(record);setDraft(Object.fromEntries(fields[name].map(f=>[f.name,f.name==='amount'?String(Number(record.amountMinor)/100):String(record[f.name]||'')])));}}>Edit</Button>{name==='invoices'&&<><Button size="sm" disabled={busy} onClick={()=>payment(record)}>Record payment</Button>{record.status==='draft'&&<Button size="sm" variant="outline" onClick={async()=>{try{await mutateBusinessRecord('invoices','update',{status:'issued'},record.id,record.version);await load();}catch(e){setError(e instanceof Error?e.message:'Unable to issue invoice');}}}>Issue invoice</Button>}</>}{name==='renewals'&&record.status!=='completed'&&<Button size="sm" onClick={async()=>{try{await mutateBusinessRecord('renewals','update',{status:'completed'},record.id,record.version);await load();}catch(e){setError(e instanceof Error?e.message:'Unable to complete renewal');}}}>Complete</Button>}<Button size="sm" variant="ghost" onClick={()=>archive(record)}>Archive</Button></div></div>{name==='invoices'&&<details className="mt-3"><summary className="cursor-pointer text-sm">Invoice and receipt documents</summary><MultiDocumentUpload recordCollection="invoices" recordId={record.id} documents={(record.documents as DocumentFile[])||[]} onChange={async docs=>{try{await mutateBusinessRecord('invoices','update',{documents:docs.map(({data,...doc})=>doc)},record.id,record.version);await load();}catch(e){setError(e instanceof Error?e.message:'Unable to save documents');}}}/></details>}</CardContent></Card>)}
      {!busy&&!records.length&&<p className="p-6 border rounded text-muted-foreground">No records yet. Add your first {name.slice(0,-1)}.</p>}
      {cursor&&<Button disabled={busy} variant="outline" onClick={async()=>{const requestScope=scopeRef.current;const page=await callApi<{records:BusinessRecord[];cursor?:string}>('crmList',{workspaceId:activeWorkspace?.id,collection:tab,pageSize:50,cursor});if(scopeRef.current!==requestScope)return;setRecords(previous=>[...previous,...page.records]);setCursor(page.cursor);}}>Load more</Button>}
      <details className="border rounded p-4"><summary className="cursor-pointer">Import CSV</summary><p className="text-xs my-2">Columns: {fields[name].map(f=>f.name).join(', ')}. Preview before importing.</p><Input type="file" accept=".csv" onChange={async e=>setCsv(await e.target.files?.[0]?.text()||'')}/>{preview&&<><p className="my-2">{preview.total} rows · {preview.errors.length} errors</p>{preview.errors.length?<><p className="text-destructive text-sm">{preview.errors.slice(0,5).map(e=>`Row ${e.row}: ${e.message}`).join('; ')}</p><Button variant="outline" onClick={()=>download(importErrorsCsv(preview.errors),'import-errors.csv')}>Download errors</Button></>:<><pre className="text-xs overflow-auto max-h-40 my-3">{JSON.stringify(preview.records.slice(0,5),null,2)}</pre><Button disabled={busy} onClick={importRows}>Import {preview.records.length} records</Button></>}</>}</details>
      </div></div>}
      {name==='reports'&&<section className="space-y-6"><div className="grid md:grid-cols-3 gap-4"><Card><CardHeader><CardTitle>Tender win rate</CardTitle></CardHeader><CardContent>{tenders.length?Math.round(tenders.filter(t=>['awarded','winner'].includes(t.status)).length/tenders.length*100):0}%<p className="text-xs text-muted-foreground">Based on loaded tenders</p></CardContent></Card><Card><CardHeader><CardTitle>Delivery completed</CardTitle></CardHeader><CardContent>{projects.filter(p=>['completed','handed-over'].includes(p.status)).length} / {projects.length} loaded projects</CardContent></Card>{finance&&<Card><CardHeader><CardTitle>Payment totals</CardTitle></CardHeader><CardContent>{Object.entries(currencies).map(([currency,total])=><p key={currency}>{currency} {total.toFixed(2)}</p>)}</CardContent></Card>}</div><Card><CardHeader><CardTitle>Upcoming deadlines</CardTitle></CardHeader><CardContent>{deadlines.map((d,i)=><p className="border-b py-2" key={i}>{d.date} · {d.kind} · {d.name}</p>)}<Button className="mt-4" variant="outline" onClick={()=>download(exportCsv(deadlines,['date','kind','name']),'deadlines.csv')}>Export deadlines</Button><Button className="m-4" variant="outline" onClick={()=>window.print()}>Print / save PDF</Button></CardContent></Card></section>}
      {name==='activity'&&<div>{records.map(record=><article className="border-b py-3" key={record.id}><p>{String(record.action||'Change')} · {String(record.collection||'')} · {String(record.recordId||'')}</p><p className="text-xs text-muted-foreground">{String(record.actorId||record.createdBy||'')} · {String(record.at||record.createdAt||'')}</p></article>)}</div>}
      {name==='archive'&&<div><div className="flex gap-2 mb-4">{['projects','tenders','customers','contacts','invoices','registrations','files'].map(c=><Button key={c} variant="outline" onClick={()=>loadArchive(c)}>{c}</Button>)}</div>{records.map(record=><div key={record.id} className="border-b py-3 flex justify-between"><p>{String(record.name||record.id)}</p><Button onClick={async()=>{await mutateBusinessRecord(String(record.collection),'restore',undefined,record.id,record.version);await loadArchive(String(record.collection));}}>Restore</Button></div>)}</div>}
    </TabsContent>)}
    </Tabs></MainLayout>;
}
