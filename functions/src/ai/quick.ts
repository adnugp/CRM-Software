import type {WorkspaceContext} from '../domain';
type Run=(name:string,args:any)=>Promise<any>;
/** Exact read shortcuts avoid hosted tokens; complex questions stay with AI. */
export function isQuickRead(message:string):boolean {
 return /^(show|list)\s+(?:(?:my\s+)?(?:upcoming\s+|overdue\s+)?deadlines|unpaid invoices|workspace overview|tenders|daily briefing|project risks)[.!?]?$/i.test(message.trim());
}
/** Deterministic CRM shortcuts, explicitly separate from a language model. */
export async function quickReply(ctx:WorkspaceContext,message:string,run:Run):Promise<{response:string;proposal?:any}> {
 const lower=message.toLowerCase();
 if(/^(show|list) daily briefing[.!?]?$/i.test(message.trim())){const result=await run('dailyBriefing',{});return {response:result.text};}
 if(/^(show|list) project risks[.!?]?$/i.test(message.trim())){const result=await run('projectRisks',{});return {response:`Observed project concerns (${result.scanned} projects scanned):\n`+(result.risks.length?result.risks.map((p:any)=>`${p.name}\n${p.reasons.map((reason:string)=>'• '+reason).join('\n')}${p.moreReasons?'\nMore concerns remain.':''}`).join('\n\n'):'No deadline, dependency or budget flags found in scanned records.')+`\n${result.scope}${result.truncated?' More projects remain; this is partial.':''}`};}
 if(/\b(delete|erase|remove all)\b/.test(lower))return {response:'I cannot delete records. Open the record to review its archive controls.'};
 if(/\b(invoices?|finance|outstanding|payments?|receivables?)\b/.test(lower)){
  const collection=/payment/.test(lower)?'payments':'invoices';const result=await run('summarizeFinance',{collection});
  return {response:`${collection==='invoices'?'Invoice balances':'Recorded payments'} — ${result.scanned} records checked.\n`+Object.entries(result.groups).map(([currency,value]:[string,any])=>`${currency} ${(value.outstandingMinor/100).toFixed(2)} outstanding${value.paidAmountMinor!==undefined?` · ${(value.paidAmountMinor/100).toFixed(2)} paid`:''} (${value.count} records)`).join('\n')+`\n${result.unavailable||0} records excluded because money/currency was unavailable.${result.truncated?' More records remain; this is a partial summary.':''}`};
 }
 if(/\b(documents?|pdfs?|files?)\b/.test(lower)){
  const query=message.replace(/^.*?\b(?:for|about)\s+/i,'').trim();const result=await run('searchDocuments',{query});
  return {response:result.matches?.length?result.matches.slice(0,5).map((match:any)=>`${match.label}${match.page?` · page ${match.page}`:match.sheet?` · sheet ${match.sheet}`:''}\n${String(match.text).slice(0,700)}`).join('\n\n'):'No indexed document matches were found. Upload a document, scan it, and index the clean version before searching its contents.'};
 }
 if(/\b(deadline|deadlines|overdue|due|upcoming)\b/.test(lower)&&!/^create task/i.test(message)){
  const result=await run('listDeadlines',{mine:/\bmy\b/.test(lower)});
  return {response:`Deadlines in ${ctx.workspace.timezone||'UTC'}: ${result.pageSummary?.overdue||0} overdue, ${result.pageSummary?.upcoming||0} due within 7 days.\n`+result.records.map((r:any)=>`${r.name} — ${r.dueDate||r.deadline||'no deadline'} · ${r.status||'unknown'}${r.projectName?` (${r.projectName})`:''}`).join('\n')+`\nReturned records only.${result.cursor?' More records are available.':''}`};
 }
 const task=message.match(/^create task\s+"([^"]+)"\s+in project\s+"([^"]+)"\s+assigned to\s+"([^"]+)"\s+due\s+(\d{4}-\d{2}-\d{2})$/i);
 if(task){const projects=await run('searchRecords',{collection:'projects',query:task[2]});const employees=await run('searchRecords',{collection:'employees',query:task[3]});const exact=(rows:any[],name:string)=>rows.filter(r=>r.name.toLowerCase()===name.toLowerCase());const p=exact(projects.records,task[2]),e=exact(employees.records,task[3]);if(p.length!==1||e.length!==1)return {response:'I need one exact project and employee name. Review the search results and include their complete names.'};const result=await run('createTask',{projectId:p[0].id,name:task[1],assignedTo:e[0].id,dueDate:task[4]});return {response:'Review this task before confirming. No change has been made yet.',proposal:result.proposal};}
 if(/\bchecklist\b/.test(lower)){
  const query=message.replace(/^.*?\b(?:for|tender)\s+/i,'').replace(/^tender\s+/i,'').replace(/^"|"$/g,'').trim();
  const result=await run('searchRecords',{collection:'tenders',query:query===message?'':query});
  if(result.records.length!==1||result.cursor)return {response:'Which tender should receive the checklist? Include its complete name.\n'+result.records.slice(0,5).map((r:any)=>r.name).join('\n')};
  const tender=result.records[0];const proposed=await run('proposeTenderChecklist',{id:tender.id,checklist:['Review the RFQ/RFP requirements and submission deadline','Verify registration and qualification documents','Prepare technical scope and exclusions','Review pricing, delivery lead time and warranty','Approve and submit the complete bid package']});
  return {response:`Draft checklist for ${tender.name}. These are general review steps, not requirements extracted from tender documents. Confirmation replaces the existing checklist; review it first.`,proposal:proposed.proposal};
 }
 if(/\b(task|assign|status change)\b/.test(lower)&&!/^show|^list/i.test(message))return {response:'To propose a task, use: Create task "Task name" in project "Exact project name" assigned to "Exact employee name" due YYYY-MM-DD. Every change requires confirmation.'};
 if(/\b(overview|summary|summarize|workspace|hello|hi)\b/.test(lower)){
  const sections=[];for(const collection of ['projects','tenders','registrations']){const result=await run('searchRecords',{collection});sections.push(`${collection}: ${result.records.length} returned${result.cursor?' (more available)':''}\n`+result.records.slice(0,5).map((r:any)=>`• ${r.name} · ${r.status||'no status'}`).join('\n'));}return {response:sections.join('\n\n')+'\nAsk for deadlines, invoice balances, a named record, document contents, or a draft tender checklist.'};
 }
 const collection=/tender/.test(lower)?'tenders':/customer/.test(lower)?'customers':/employee|team/.test(lower)?'employees':/registration|licence|license/.test(lower)?'registrations':/renewal/.test(lower)?'renewals':'projects';
 const query=message.match(/\b(?:named|about|for)\s+(.+)$/i)?.[1]?.replace(/^"|"$/g,'')||'';
 const result=await run('searchRecords',{collection,query});const rows=collection==='projects'&&/\btasks?\b/.test(lower)?result.records.flatMap((project:any)=>(project.tasks||[]).map((task:any)=>({...task,projectName:project.name}))):result.records;
 const records=/\bmy\b/.test(lower)?rows.filter((r:any)=>r.assignedTo===ctx.uid||r.assignedUserIds?.includes(ctx.uid)):rows;
 return {response:records.length?`${records.length} ${collection==='projects'&&/\btasks?\b/.test(lower)?'tasks':collection} returned${result.cursor?' (more available)':''}:\n`+records.map((r:any)=>`${r.name} · ${r.status||'active'}${r.deadline||r.dueDate?` · due ${r.deadline||r.dueDate}`:''}${r.assignedToName?` · assigned to ${r.assignedToName}`:''}${r.projectName?` (${r.projectName})`:''}${r.description?`\n${r.description}`:''}`).join('\n\n'):'No matching accessible records were found. Try an exact name or ask for a workspace overview.'};
}
