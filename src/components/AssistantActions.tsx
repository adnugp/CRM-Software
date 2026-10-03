import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {AssistantSuggestions,assistantSuggestionsPrompt} from '@/lib/assistant';

interface Props {suggestions?:AssistantSuggestions;disabled:boolean;modelDisabled:boolean;onAsk:(message:string)=>void;}
export default function AssistantActions({suggestions,disabled,modelDisabled,onAsk}:Props) {
  const [selected,setSelected]=useState<Record<string,string>>({});
  const [task,setTask]=useState(''),[dueDate,setDueDate]=useState('');
  const records=suggestions?.records||{};
  const choose=(collection:string)=>records[collection]?.find(record=>record.id===selected[collection]);
  const selector=(collection:string,label:string)=><label className="block space-y-1 text-xs" key={collection}><span>{label}</span><select aria-label={label} className="w-full rounded-md border bg-background p-2 text-foreground" value={selected[collection]||''} disabled={disabled||modelDisabled||!records[collection]?.length} onChange={event=>setSelected(prev=>({...prev,[collection]:event.target.value}))}><option value="">{records[collection]?.length?`Select ${label.toLowerCase()}`:`No ${label.toLowerCase()} available in this list`}</option>{(records[collection]||[]).map(record=><option key={record.id} value={record.id}>{record.name}</option>)}</select></label>;
  const groups=[['projects','Project','Summarize project'],['tenders','Tender','Draft tender checklist'],['customers','Customer','Draft follow-up email'],['invoices','Invoice','Draft payment reminder'],['files','Clean document','Analyze document']];
  return <details className="border rounded-lg p-3 text-sm"><summary className="cursor-pointer font-medium">Workspace actions and drafts</summary><div className="space-y-3 mt-3">
    {!suggestions&&<p className="text-xs text-muted-foreground">Loading available records…</p>}
    {groups.filter(([collection])=>collection in records).map(([collection,label,action])=><div className="space-y-2" key={collection}>{selector(collection,label)}<Button size="sm" variant="outline" className="w-full" disabled={disabled||modelDisabled||!choose(collection)} onClick={()=>{const choice=choose(collection);if(choice)onAsk(assistantSuggestionsPrompt(collection,choice));}}>{action}</Button></div>)}
    {!!records.projects?.length&&!!records.employees?.length&&<div className="border-t pt-3 space-y-2"><p className="font-medium text-xs">Propose a task</p>{selector('projects','Project')}{selector('employees','Employee')}<Input aria-label="Task name" placeholder="Task name" maxLength={200} value={task} disabled={disabled||modelDisabled} onChange={event=>setTask(event.target.value)}/><label className="text-xs block">Due date<Input aria-label="Task due date" type="date" value={dueDate} disabled={disabled||modelDisabled} onChange={event=>setDueDate(event.target.value)}/></label><Button size="sm" className="w-full" disabled={disabled||modelDisabled||!task.trim()||!dueDate||!choose('projects')||!choose('employees')} onClick={()=>onAsk(`Create task ${JSON.stringify(task.trim())} in project ${JSON.stringify(choose('projects')!.name)} (ID ${choose('projects')!.id}) assigned to ${JSON.stringify(choose('employees')!.name)} (employee ID ${choose('employees')!.id}) due ${dueDate}. Propose for confirmation only.`)}>Review task proposal</Button></div>}
    {suggestions&&<p className="text-xs text-muted-foreground">{suggestions.scope}</p>}
    <p className="text-xs text-muted-foreground">Drafts and analysis use the configured AI provider. Copy drafts to review and send yourself. Document analysis needs a clean indexed version.</p>
  </div></details>;
}
