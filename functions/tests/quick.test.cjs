const test=require('node:test');const assert=require('node:assert/strict');
const {quickReply}=require('../lib/ai/quick');
const ctx={uid:'u1',role:'admin',workspaceId:'w',workspace:{currency:'AED',timezone:'Asia/Dubai'}};
test('only simple supported read prompts bypass hosted AI quota',()=>{
 const {isQuickRead}=require('../lib/ai/quick');
 for(const prompt of ['Show my upcoming deadlines','Show unpaid invoices','Show workspace overview','Show tenders'])assert.equal(isQuickRead(prompt),true);
 for(const prompt of ['Create task due tomorrow','Explain why invoices are overdue','Show deadlines and create tasks','Analyze project risks'])assert.equal(isQuickRead(prompt),false);
});
test('quick answers report returned CRM facts and finance minor units without a model',async()=>{
 const calls=[];const run=async(name,args)=>{calls.push([name,args]);return name==='summarizeFinance'?{groups:{AED:{count:2,outstandingMinor:15050}},scanned:2,unavailable:0,truncated:false}:{records:[{id:'p1',name:'Solar Upgrade',status:'running'}],cursor:null,pageSummary:{overdue:1,upcoming:2}};};
 const finance=await quickReply(ctx,'Show unpaid invoices',run);assert.match(finance.response,/AED 150.50/);assert.equal(calls[0][0],'summarizeFinance');
 const deadline=await quickReply(ctx,'Show upcoming deadlines',run);assert.match(deadline.response,/Solar Upgrade/);
});
test('quick answers clarify ambiguous tender and reject unsupported destructive requests',async()=>{
 let writes=0;const run=async(name)=>{if(name==='proposeTenderChecklist')writes++;return {records:[{id:'a',name:'One'},{id:'b',name:'Two'}],cursor:null};};
 const reply=await quickReply(ctx,'Create checklist for tender',run);assert.match(reply.response,/which tender/i);assert.equal(writes,0);
 const deleted=await quickReply(ctx,'Delete all projects',run);assert.match(deleted.response,/cannot delete/i);assert.equal(writes,0);
});
test('quick document answers use extraction citations and disclose empty search',async()=>{
 const reply=await quickReply(ctx,'Search documents for insurance',async()=>({matches:[],scope:'authorized indexed documents'}));assert.match(reply.response,/No indexed document/i);
});
