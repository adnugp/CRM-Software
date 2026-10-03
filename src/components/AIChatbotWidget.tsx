import {useEffect,useRef,useState} from 'react';
import {MessageSquare,X,Send,CheckCircle,AlertCircle,Loader2,Plus,Maximize2,Minimize2,RotateCcw,Sparkles,History,Copy} from 'lucide-react';
import {Link} from 'react-router-dom';
import {useAuth} from '@/contexts/AuthContext';
import {useData} from '@/contexts/DataContext';
import {callApi} from '@/services/api';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import AssistantActions from '@/components/AssistantActions';
import {AssistantSuggestions,assistantRetry,isAssistantQuickPrompt} from '@/lib/assistant';

interface Citation{collection:string;id:string;label:string;page?:number;sheet?:string;}
interface Proposal{id:string;summary:string;tool:string;args:Record<string,unknown>;preview?:{recordName:string;taskName:string;changes:Record<string,unknown>};expiresAt:number;}
interface Reply{conversationId:string;response:string;citations:Citation[];proposal?:Proposal;mode?:'quick'|'model';}
interface Message{id:string;role:'user'|'assistant';content:string;citations?:Citation[];proposal?:Proposal;confirmed?:boolean;dismissed?:boolean;mode?:'quick'|'model';}
interface Status{mode:'quick'|'model';ready:boolean;documents:{scannerConfigured:boolean;ocrConfigured:boolean};canUseFinance:boolean;}
interface SavedChat{id:string;title:string;updatedAt:number;}
function display(value:unknown):string{if(Array.isArray(value))return value.map(item=>typeof item==='string'?item:String((item as {text?:string}).text||'')).join('\n');return String(value??'');}
const labels:Record<string,string>={name:'Task',description:'Description',assignedToName:'Assigned to',dueDate:'Due date',startDate:'Start date',status:'Status',priority:'Priority',dependencies:'Dependencies',checklist:'Draft checklist'};
function recordRoute(c:Citation){return c.collection==='projects'?`/projects/${encodeURIComponent(c.id)}`:c.collection==='tenders'?'/tenders':c.collection==='files'?'/files':c.collection==='employees'?'/employees':c.collection==='registrations'?'/registrations':c.collection==='payments'?'/payments':['invoices','customers','contacts','renewals'].includes(c.collection)?`/operations?tab=${c.collection}`:'/operations';}
export default function AIChatbotWidget(){
 const {activeWorkspace,user}=useAuth();const {refresh}=useData();
 const [open,setOpen]=useState(false),[expanded,setExpanded]=useState(false),[messages,setMessages]=useState<Message[]>([]),[input,setInput]=useState('');
 const [conversationId,setConversationId]=useState<string>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[failed,setFailed]=useState(''),[status,setStatus]=useState<Status>(),[now,setNow]=useState(Date.now());
 const [suggestions,setSuggestions]=useState<AssistantSuggestions>(),[suggestionError,setSuggestionError]=useState('');
 const [historyOpen,setHistoryOpen]=useState(false),[savedChats,setSavedChats]=useState<SavedChat[]>([]),[historyBusy,setHistoryBusy]=useState(false);
 const [cooldown,setCooldown]=useState<{until:number;scope:string}>(),[copied,setCopied]=useState('');
 const identity=`${activeWorkspace?.id}/${user?.id}/${user?.role}`;const current=useRef(identity);current.current=identity;const bottom=useRef<HTMLDivElement>(null);
 const generation=useRef(0),inFlight=useRef(false);
 const remaining=cooldown?Math.max(0,Math.ceil((cooldown.until-now)/1000)):0;
 const modelDisabled=remaining>0||status?.mode==='quick'||status?.ready===false;
 useEffect(()=>{generation.current++;inFlight.current=false;setMessages([]);setConversationId(undefined);setBusy(false);setError('');setInput('');setStatus(undefined);setFailed('');setSuggestions(undefined);setSuggestionError('');setSavedChats([]);setHistoryOpen(false);setHistoryBusy(false);setCooldown(undefined);setCopied('');},[identity]);
 useEffect(()=>{if(!open||!activeWorkspace||!user||user.role==='client')return;let cancelled=false;
  callApi<Status>('aiStatus',{workspaceId:activeWorkspace.id}).then(value=>{if(!cancelled)setStatus(value);}).catch(e=>{if(!cancelled)setError(e.message);});
  callApi<AssistantSuggestions>('aiSuggestions',{workspaceId:activeWorkspace.id}).then(value=>{if(!cancelled)setSuggestions(value);}).catch(()=>{if(!cancelled)setSuggestionError('Workspace suggestions could not load. Close and reopen the assistant to retry.');});
  return()=>{cancelled=true;};
 },[open,activeWorkspace,user]);
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},[messages,busy]);
 useEffect(()=>{if(!open)return;const timer=setInterval(()=>setNow(Date.now()),1000);const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};window.addEventListener('keydown',close);return()=>{clearInterval(timer);window.removeEventListener('keydown',close);};},[open]);
 async function ask(text:string,append=true){
  if(!text.trim()||inFlight.current||historyBusy||!activeWorkspace)return;
  const quick=isAssistantQuickPrompt(text);
  if(remaining>0&&(cooldown?.scope!=='provider'||!quick)){setError(`Please wait ${remaining}s before retrying this request.`);return;}
  const requestIdentity=current.current,requestGeneration=generation.current;inFlight.current=true;setInput('');setBusy(true);setError('');setFailed('');setHistoryOpen(false);
  const valid=()=>current.current===requestIdentity&&generation.current===requestGeneration;
  if(append)setMessages(previous=>[...previous,{id:crypto.randomUUID(),role:'user',content:text.trim()}]);
  try{const reply=await callApi<Reply>('aiChat',{workspaceId:activeWorkspace.id,conversationId,message:text.trim()});if(!valid())return;setConversationId(reply.conversationId);setMessages(previous=>[...previous,{id:crypto.randomUUID(),role:'assistant',content:reply.response,citations:reply.citations,proposal:reply.proposal,mode:reply.mode}]);}
  catch(e){if(valid()){setError(e instanceof Error?e.message:'Unable to reach the assistant.');setFailed(text);const retry=assistantRetry(e);if(retry.seconds){setNow(Date.now());setCooldown({until:Date.now()+retry.seconds*1000,scope:retry.scope||'request'});}else if(retry.scope==='workspace')setCooldown(undefined);}}
  finally{if(valid()){inFlight.current=false;setBusy(false);}}
 }
 async function confirm(message:Message){if(!message.proposal||!activeWorkspace||inFlight.current||now>=message.proposal.expiresAt)return;const requestIdentity=current.current;inFlight.current=true;setBusy(true);setError('');try{await callApi('aiConfirm',{workspaceId:activeWorkspace.id,proposalId:message.proposal.id});if(current.current!==requestIdentity)return;setMessages(previous=>previous.map(item=>item.id===message.id?{...item,confirmed:true}:item));await refresh();}catch(e){if(current.current===requestIdentity)setError(e instanceof Error?e.message:'The action could not be completed.');}finally{if(current.current===requestIdentity){inFlight.current=false;setBusy(false);}}}
 function newChat(){if(busy||historyBusy)return;generation.current++;setMessages([]);setConversationId(undefined);setError('');setInput('');setFailed('');setHistoryOpen(false);}
 async function loadHistory(id?:string){
  if(!activeWorkspace||busy||historyBusy)return;const requestIdentity=current.current;let requestGeneration=generation.current;const valid=()=>current.current===requestIdentity&&generation.current===requestGeneration;setHistoryBusy(true);setError('');
  try{
   if(id){const result=await callApi<{conversationId:string;messages:Omit<Message,'id'>[]}>('aiHistory',{workspaceId:activeWorkspace.id,conversationId:id});if(!valid())return;requestGeneration=++generation.current;setConversationId(result.conversationId);setMessages(result.messages.map(message=>({...message,id:crypto.randomUUID()})));setHistoryOpen(false);setFailed('');setInput('');}
   else{setHistoryOpen(true);const result=await callApi<{conversations:SavedChat[]}>('aiHistory',{workspaceId:activeWorkspace.id});if(valid())setSavedChats(result.conversations);}
  }catch(e){if(valid())setError(e instanceof Error?e.message:'Unable to load saved conversations.');}
  finally{if(valid())setHistoryBusy(false);}
 }
 async function copy(message:Message){const requestIdentity=current.current;try{await navigator.clipboard.writeText(message.content);if(current.current===requestIdentity)setCopied(message.id);}catch{if(current.current===requestIdentity)setError('Copy unavailable. Select the reply text and copy it manually.');}}
 if(!activeWorkspace||!user||user.role==='client')return null;
 const prompts=['Show daily briefing','Show project risks','Show workspace overview','Show my upcoming deadlines',...(user.role==='admin'||user.role==='manager'?['Show unpaid invoices']:[])];
 return <div className="fixed bottom-5 right-5 z-50">{!open?<Button className="rounded-full shadow-lg gap-2" onClick={()=>setOpen(true)} aria-expanded={false}><MessageSquare size={18}/>CRM assistant</Button>:<section role="dialog" aria-label="CRM assistant" className={`${expanded?'w-[min(760px,calc(100vw-40px))]':'w-[min(460px,calc(100vw-40px))]'} h-[min(720px,85vh)] bg-card border rounded-xl shadow-xl flex flex-col overflow-hidden`}>
  <header className="border-b p-4 flex items-center justify-between gap-2"><div><h2 className="font-semibold flex gap-2 items-center"><Sparkles size={18}/>CRM assistant</h2><p className="text-xs text-muted-foreground">{activeWorkspace.name} / {status?.mode==='quick'?'CRM quick answers':status?.ready?'AI configured':'Checking connection...'}</p></div><div className="flex"><Button variant="ghost" size="icon" aria-label="Saved conversations" disabled={busy||historyBusy} onClick={()=>historyOpen?setHistoryOpen(false):void loadHistory()}><History size={17}/></Button><Button variant="ghost" size="icon" aria-label="New conversation" disabled={busy||historyBusy} onClick={newChat}><Plus size={17}/></Button><Button variant="ghost" size="icon" aria-label={expanded?'Compact assistant':'Expand assistant'} onClick={()=>setExpanded(!expanded)}>{expanded?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</Button><Button variant="ghost" size="icon" aria-label="Close assistant" onClick={()=>setOpen(false)}><X size={18}/></Button></div></header>
  {status?.mode==='quick'&&<p className="text-xs bg-muted px-4 py-2">CRM quick answers use records directly. Configure a model for free-form analysis and drafts.</p>}
  {remaining>0&&<div className="text-xs bg-muted px-4 py-2" role="status">Retry in {remaining}s (estimated wait). {cooldown?.scope==='provider'?'CRM quick answers remain available.':'The CRM request limit also applies to quick answers.'}</div>}
  {historyOpen&&<div className="border-b p-3 max-h-56 overflow-auto space-y-2"><h3 className="text-sm font-medium">Your saved conversations</h3><p className="text-xs text-muted-foreground">This account and workspace only. Saved proposals must be requested again.</p>{historyBusy?<p className="text-xs">Loading...</p>:!savedChats.length?<p className="text-xs">No available saved conversations.</p>:savedChats.map(chat=><Button key={chat.id} variant="outline" className="w-full h-auto text-left justify-start whitespace-normal" disabled={historyBusy} onClick={()=>void loadHistory(chat.id)}>{chat.title}<span className="text-xs text-muted-foreground ml-auto pl-2">{new Date(chat.updatedAt).toLocaleDateString()}</span></Button>)}</div>}
  <div className="flex-1 overflow-auto p-4 space-y-4" aria-live="polite">
   {!messages.length&&<div className="space-y-4"><h3 className="font-medium">What needs your attention?</h3><p className="text-sm text-muted-foreground">Check your workspace, draft follow-ups, and review proposed changes.</p><div className="grid gap-2">{prompts.map(prompt=><Button key={prompt} variant="outline" className="justify-start h-auto whitespace-normal text-left" disabled={busy||historyBusy||(remaining>0&&cooldown?.scope!=='provider')} onClick={()=>void ask(prompt)}>{prompt}</Button>)}</div><p className="text-xs text-muted-foreground">Briefings and risk checks use CRM records without AI API tokens. Free-form chat and drafts use your provider quota.</p></div>}
   {suggestionError?<p className="text-xs text-destructive">{suggestionError}</p>:<AssistantActions key={identity} suggestions={suggestions} disabled={busy||historyBusy} modelDisabled={modelDisabled} onAsk={text=>void ask(text)}/>}
   {messages.map(message=><article key={message.id} className={`p-3 rounded-lg text-sm ${message.role==='user'?'bg-primary text-primary-foreground ml-8':'bg-muted mr-2'}`}>
    <p className="whitespace-pre-wrap">{message.content}</p>
    {message.role==='assistant'&&<div className="flex items-center justify-between mt-2"><span className="text-xs text-muted-foreground">{message.mode==='quick'?'CRM quick answer':message.mode==='model'?'AI-generated / review before use':'Saved reply'}</span><Button size="sm" variant="ghost" aria-label="Copy assistant reply" onClick={()=>void copy(message)}><Copy size={14} className="mr-1"/>{copied===message.id?'Copied':'Copy'}</Button></div>}
    {!!message.citations?.length&&<details className="border-t mt-3 pt-2"><summary className="cursor-pointer text-xs">Sources ({message.citations.length})</summary><div className="space-y-1 mt-2">{message.citations.map(c=><Link key={`${c.collection}/${c.id}/${c.page||''}/${c.sheet||''}`} className="block underline text-xs" to={recordRoute(c)}>{c.label}{c.page?` / page ${c.page}`:''}{c.sheet?` / sheet ${c.sheet}`:''}</Link>)}</div></details>}
    {message.proposal&&<div className="border rounded mt-3 p-3 bg-card text-foreground"><h3 className="font-medium">Review proposed change</h3><p className="my-2">{message.proposal.summary}</p>{message.proposal.preview&&<dl className="space-y-2 text-xs">{Object.entries(message.proposal.preview.changes).map(([key,value])=><div key={key}><dt className="text-muted-foreground">{labels[key]||key}</dt><dd className="whitespace-pre-wrap font-medium">{display(value)}</dd></div>)}</dl>}<p className="text-xs text-muted-foreground my-3">{now>=message.proposal.expiresAt?'Proposal expired. Request a new one.':`Expires ${new Date(message.proposal.expiresAt).toLocaleTimeString()}`}</p>{message.confirmed?<p className="flex gap-2 items-center text-green-700"><CheckCircle size={16}/>Change completed</p>:message.dismissed?<p className="text-xs text-muted-foreground">Dismissed / no change made</p>:<div className="flex gap-2"><Button disabled={busy||now>=message.proposal.expiresAt} onClick={()=>void confirm(message)}>Confirm change</Button><Button variant="outline" disabled={busy} onClick={()=>setMessages(previous=>previous.map(item=>item.id===message.id?{...item,dismissed:true}:item))}>Dismiss</Button></div>}</div>}
   </article>)}
   {busy&&<p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" size={16}/>Checking your workspace...</p>}
   {error&&<div role="alert" className="text-destructive text-sm"><p className="flex gap-2"><AlertCircle size={16}/>{error}</p>{failed&&<Button size="sm" variant="outline" className="mt-2" onClick={()=>void ask(failed,false)} disabled={busy||historyBusy||(remaining>0&&(cooldown?.scope!=='provider'||!isAssistantQuickPrompt(failed)))}><RotateCcw size={14} className="mr-2"/>Retry</Button>}{remaining>0&&cooldown?.scope==='provider'&&<div className="mt-2 flex gap-2 flex-wrap">{['Show daily briefing','Show my upcoming deadlines'].map(prompt=><Button key={prompt} size="sm" variant="outline" disabled={busy||historyBusy} onClick={()=>void ask(prompt)}>{prompt}</Button>)}</div>}</div>}
   <div ref={bottom}/>
  </div>
  <form onSubmit={e=>{e.preventDefault();void ask(input);}} className="p-3 border-t flex gap-2"><Input aria-label="Message" placeholder="Ask about your CRM..." value={input} maxLength={4000} onChange={e=>setInput(e.target.value)} disabled={busy||historyBusy}/><Button type="submit" size="icon" aria-label="Send message" disabled={busy||historyBusy||!input.trim()||(remaining>0&&(cooldown?.scope!=='provider'||!isAssistantQuickPrompt(input)))}><Send size={16}/></Button></form>
 </section>}</div>;
}
