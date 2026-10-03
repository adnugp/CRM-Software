import {useState} from 'react';
import {useAuth} from '@/contexts/AuthContext';
import {useData} from '@/contexts/DataContext';
import type {Tender} from '@/types';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';

export default function TenderWorkflow({tender}:{tender:Tender}) {
 const {user}=useAuth(); const {updateTender}=useData();
 const [text,setText]=useState(''); const [question,setQuestion]=useState(''); const [answer,setAnswer]=useState('');
 const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
 const manage=user?.role==='admin'||user?.role==='manager';const staff=manage||user?.role==='user';
 const checklist=(tender.checklist||[]).map((item,index)=>typeof item==='string'?{id:`item_${index}`,text:item,completed:false}:item);
 async function save(data:Partial<Tender>) {setBusy(true);setError('');try{await updateTender(tender.id,{...data,version:tender.version});}catch(e){setError(e instanceof Error?e.message:'Unable to save');}finally{setBusy(false);}}
 return <div className="space-y-6">{error&&<p role="alert" className="text-destructive">{error}</p>}
 <section><h3 className="font-medium">Submission checklist</h3>{checklist.map((item,index)=><label key={item.id} className="flex gap-3 py-2 border-b"><input type="checkbox" disabled={!staff||busy} checked={item.completed} onChange={e=>save({checklist:checklist.map((row,i)=>i===index?{...row,completed:e.target.checked}:row)})}/>{item.text}</label>)}{staff&&<form className="flex gap-2 mt-3" onSubmit={e=>{e.preventDefault();save({checklist:[...checklist,{id:crypto.randomUUID(),text,completed:false}]}).then(()=>setText(''));}}><Input aria-label="Checklist item" required maxLength={500} value={text} onChange={e=>setText(e.target.value)} placeholder="Required submission item"/><Button disabled={busy}>Add</Button></form>}</section>
 <section><h3 className="font-medium">Clarifications</h3>{(tender.clarifications||[]).map(item=><article key={item.id} className="border-b py-3"><p className="font-medium">{item.question}</p><p className="whitespace-pre-wrap text-sm">{item.answer||'Awaiting answer'}</p><p className="text-xs text-muted-foreground">{item.createdAt}</p></article>)}{staff&&<form className="space-y-2 mt-3" onSubmit={e=>{e.preventDefault();save({clarifications:[...(tender.clarifications||[]),{id:crypto.randomUUID(),question,answer,createdAt:new Date().toISOString(),createdBy:user!.id}]}).then(()=>{setQuestion('');setAnswer('');});}}><Input aria-label="Clarification question" required maxLength={1000} placeholder="Question or clarification" value={question} onChange={e=>setQuestion(e.target.value)}/><textarea aria-label="Clarification answer" className="border rounded p-2 w-full bg-background" maxLength={4000} placeholder="Answer or response" value={answer} onChange={e=>setAnswer(e.target.value)}/><Button disabled={busy}>Record clarification</Button></form>}</section>
 {manage&&<section><h3 className="font-medium">Approval history</h3><p className="text-sm text-muted-foreground">Record the submission review decision. Awarded tenders convert once into a linked project.</p>{(tender.approvalSteps||[]).map(item=><p key={item.id} className="text-sm border-b py-2">{item.label}: {item.status} · {item.actorId} · {item.at}</p>)}<div className="flex gap-2 mt-3">{(['approved','rejected'] as const).map(status=><Button key={status} variant="outline" disabled={busy} onClick={()=>save({approvalSteps:[...(tender.approvalSteps||[]),{id:crypto.randomUUID(),label:'Submission review',status,actorId:user!.id,at:new Date().toISOString()}]})}>{status==='approved'?'Approve submission':'Reject submission'}</Button>)}</div></section>}
 </div>;
}
