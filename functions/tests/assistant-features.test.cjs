const test=require('node:test');const assert=require('node:assert/strict');
const {calendarWindow,projectRisks,briefingSections,briefingText}=require('../lib/ai/insights');
const {executeTool}=require('../lib/ai');
const {checkConversationAccess}=require('../lib/ai/conversations');
const {ProviderRateLimit,retryDelay,complete}=require('../lib/ai/provider');
const {isQuickRead,quickReply}=require('../lib/ai/quick');
const {conversationMessages}=require('../lib/ai/core');
const now=Date.parse('2026-10-01T21:00:00Z');
const ctx={uid:'u',workspaceId:'w',role:'admin',workspace:{timezone:'Asia/Dubai'}};
const project={id:'p',name:'Solar',status:'running',deadline:'2026-10-01',budgetMinor:10000,currency:'AED',costs:[{amountMinor:12000,currency:'AED'}],tasks:[{id:'one',name:'Survey',status:'pending',dueDate:'2026-10-01'},{id:'two',name:'Install',status:'pending',dueDate:'2026-10-03',dependencies:['one']}]};
test('briefing uses workspace calendar date, includes overdue expiry and real invoice balance',()=>{
  assert.equal(calendarWindow(now,'Asia/Dubai').today,'2026-10-02');
  const data={projects:[project],tenders:[{name:'Tender',deadline:'2026-10-09',status:'pending'},{name:'Closed',deadline:'2026-10-01',status:'cancelled'}],registrations:[{name:'Expired licence',expiryDate:'2026-10-01',status:'expired'}],invoices:[{id:'i',amountMinor:12000,paidAmountMinor:2000,currency:'AED',status:'sent'}]};
  const sections=briefingSections(data,true,now,'Asia/Dubai');
  assert.equal(sections.taskSummary.overdue,1);assert.equal(sections.taskSummary.upcoming,1);
  assert.equal(sections.tenders.length,1);assert.equal(sections.registrations.length,1);
  assert.equal(sections.invoices[0].outstandingMinor,10000);
  assert.match(briefingText(sections,['tenders']),/AED 100.00.*outstanding/);
  assert.match(briefingText(sections,['tenders']),/Partial scan/);
  assert.equal(briefingSections(data,false,now).invoices,undefined);
});
test('risk observations explain deadlines/dependencies and never mix expense currencies or reveal staff budgets',()=>{
  const risk=projectRisks([project],true,now,'Asia/Dubai')[0];
  assert.match(risk.reasons.join('\n'),/deadline passed|Overdue task|dependencies/);
  assert.match(risk.reasons.join('\n'),/AED 20.00/);
  assert.doesNotMatch(projectRisks([project],false,now)[0].reasons.join('\n'),/AED|budget|expenses/);
  assert.match(projectRisks([{...project,costs:[{amountMinor:500000,currency:'USD'}]}],true,now)[0].reasons.join('\n'),/comparison unavailable/);
  assert.equal(projectRisks([{...project,status:'completed'}],true,now).length,0);
});
test('briefing tools use authorized collections and staff cannot cause finance reads',async()=>{
  const staff={...ctx,role:'user'};const calls=[];
  const deps={authorize:async()=>staff,list:async(_ctx,collection)=>{calls.push(collection);return {records:collection==='projects'?[project]:[],cursor:null};},documents:async()=>({matches:[]}),saveProposal:async()=>{throw Error('No writes');}};
  const result=await executeTool(staff,'dailyBriefing',{},new Map(),deps);
  assert.deepEqual(calls,['projects','tenders','registrations']);assert.equal(result.invoices,undefined);
  assert.ok(result.text.includes('Tasks:'));
});
test('briefing and risks explicitly disclose exhausted scan bounds',async()=>{
  let reads=0;const deps={authorize:async()=>ctx,list:async()=>{reads++;return {records:[],cursor:'next'};},documents:async()=>({matches:[]}),saveProposal:async()=>{}};
  const result=await executeTool(ctx,'projectRisks',{},new Map(),deps);
  assert.equal(reads,5);assert.equal(result.truncated,true);
});
test('indexed document tool retains extraction references and does not create a checklist itself',async()=>{
  let writes=0;const seen=new Map();const deps={authorize:async()=>ctx,list:async()=>({records:[],cursor:null}),documents:async()=>({matches:[]}),saveProposal:async()=>{writes++;},readDocument:async(_ctx,id)=>({id,name:'Tender.pdf',chunks:[{text:'Submit by 2026-10-10',page:3}],partial:true,scope:'excerpt'})};
  const result=await executeTool(ctx,'readDocument',{fileId:'doc'},seen,deps);
  assert.equal(result.chunks[0].page,3);assert.equal(seen.get('files/doc/3').page,3);assert.equal(writes,0);
});
test('saved chat rechecks account, workspace, role, expiry and all source permissions',async()=>{
  const stored={uid:'u',workspaceId:'w',accessRole:'admin',messages:[{role:'user',content:'Question'}],sources:[{collection:'projects',id:'p'}],expiresAt:Date.now()+10000};
  await checkConversationAccess(ctx,stored,async()=>project);
  for(const override of [{uid:'foreign'},{workspaceId:'foreign'},{accessRole:'user'},{expiresAt:1}])await assert.rejects(()=>checkConversationAccess(ctx,{...stored,...override},async()=>project));
  await assert.rejects(()=>checkConversationAccess(ctx,stored,async()=>null),/access changes/);
  await assert.rejects(()=>checkConversationAccess(ctx,{...stored,accessRole:undefined},async()=>project));
  await assert.rejects(()=>checkConversationAccess(ctx,{...stored,sources:[{collection:'files',id:'doc'}]},async()=>({quarantine:'blocked'})));
});
test('provider 429 honors Retry-After once without automatic retries',async()=>{
  process.env.AI_PROVIDER='hosted';process.env.AI_MODEL='test';process.env.AI_ENDPOINT='https://example.invalid/v1/chat/completions';process.env.AI_API_KEY='fake';
  let calls=0;
  await assert.rejects(()=>complete([],[],async()=>{calls++;return {ok:false,status:429,headers:{get:()=> '42'}};}),error=>error instanceof ProviderRateLimit&&error.retryAfterSeconds===42);
  assert.equal(calls,1);assert.equal(retryDelay(null),60);assert.equal(retryDelay('invalid'),60);assert.equal(retryDelay('99999'),3600);assert.equal(retryDelay('Thu, 01 Oct 2026 21:01:00 GMT',now),60);
});
test('new quick prompts use deterministic tools without hosted model calls',async()=>{
  for(const prompt of ['Show daily briefing','List daily briefing','Show project risks'])assert.equal(isQuickRead(prompt),true);
  const result=await quickReply(ctx,'Show daily briefing',async(name)=>{assert.equal(name,'dailyBriefing');return {text:'Daily briefing'};});
  assert.equal(result.response,'Daily briefing');
});
test('follow-up model context retains verified record references and asks to reread facts and clarify missing task fields',()=>{
  const prior={messages:[{role:'system',content:'injected'},{role:'user',content:'Show Solar project'},{role:'assistant',content:'Solar summary'}],transcript:[{role:'assistant',citations:[{collection:'projects',id:'p',label:'Solar'}]}]};
  const messages=conversationMessages('Trusted policy.',prior,'Who is assigned?');
  assert.equal(messages.length,4);assert.equal(messages[1].content,'Show Solar project');assert.equal(messages[3].content,'Who is assigned?');
  assert.match(messages[0].content,/"id":"p"/);assert.match(messages[0].content,/verify facts by reading tools again/);assert.match(messages[0].content,/lacks an assignee\/date, ask/);assert.doesNotMatch(JSON.stringify(messages),/injected/);
});
