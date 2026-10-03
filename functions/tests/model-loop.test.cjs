const test=require('node:test');
const assert=require('node:assert/strict');
test('sequential project lookup, assignee lookup and proposal get enough bounded model rounds',async()=>{
 const {runModel}=require('../lib/ai/run.js');
 const calls=['searchRecords','searchRecords','createTask'];let round=0;const executed=[];
 const proposal={id:'proposal',summary:'Create review task',tool:'createTask',expiresAt:Date.now()+60000};
 const result=await runModel([{role:'user',content:'Create review task'}],[{type:'function'}],async(name)=>{executed.push(name);return name==='createTask'?{proposal}:{records:[{id:'verified'}]};},async(messages,tools)=>{
  if(round<3){assert.ok(tools.length);const name=calls[round++];return {tool_calls:[{id:String(round),function:{name,arguments:'{}'}}]};}
  round++;return {content:'Please confirm the proposed task.'};
 });
 assert.deepEqual(executed,calls);assert.equal(result.proposal.id,'proposal');assert.match(result.reply,/confirm/);assert.equal(round,4);
});
test('model loop bounds calls and rejects tools in final response round',async()=>{
 const {runModel}=require('../lib/ai/run.js');let calls=0;
 await assert.rejects(()=>runModel([],[],async()=>({}),async()=>{calls++;return {tool_calls:[{id:'call',function:{name:'searchRecords',arguments:'{}'}}]};}),/too many actions/);
 assert.equal(calls,5);
});
