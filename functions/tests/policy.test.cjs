const test = require('node:test');
const assert = require('node:assert/strict');
const { canRead, canWrite, validateData, moneyToMinor } = require('../lib/policy');
const ctx = role => ({uid:'u1', role});
test('tenant roles scope assigned staff and explicit clients', () => {
 assert.equal(canRead(ctx('user'), 'projects', {assignedTo:'other'}), false);
 assert.equal(canRead(ctx('user'), 'projects', {assignedTo:'u1'}), true);
 assert.equal(canRead(ctx('client'), 'projects', {clientId:'u1'}), false);
 assert.equal(canRead(ctx('client'), 'projects', {sharedWith:['u1']}), true);
 assert.equal(canRead(ctx('user'), 'payments', {assignedTo:'u1'}), false);
});
test('only staff writes and finance requires management', () => {
 assert.equal(canWrite(ctx('client'), 'projects','update',{}), false);
 assert.equal(canWrite(ctx('user'), 'payments','create',{}), false);
 assert.equal(canWrite(ctx('user'), 'projects','delete',{assignedTo:'u1'}), false);
 assert.equal(canWrite(ctx('manager'), 'projects','update',{}), true);
});
test('immutable ownership and unsafe embedded uploads rejected', () => {
 assert.throws(()=>validateData('projects',{workspaceId:'evil'}));
 assert.throws(()=>validateData('projects',{documents:[{data:'base64'}]}));
 assert.throws(()=>validateData('projects',{name:'x',status:'unknown'}));
});
test('money stored as integer minor units', () => {
 assert.equal(moneyToMinor(123.45),12345);
 assert.throws(()=>moneyToMinor(-1));
 assert.throws(()=>moneyToMinor(NaN));
});
test('integer money rejects invalid scale and invoice overpayment', () => {
 assert.equal(validateData('invoices',{amountMinor:12345,paidAmountMinor:0}).amountMinor,12345);
 assert.throws(()=>validateData('invoices',{amountMinor:1.5}));
 assert.throws(()=>validateData('invoices',{amountMinor:-1}));
});
test('staff cannot change finance fields embedded in project', () => {
 assert.equal(canWrite(ctx('user'),'projects','update',{assignedTo:'u1'}, {budget:5}), false);
});
test('dates accepted in date-only canonical format',()=>{
 assert.equal(validateData('tasks',{dueDate:'2026-10-01'}).dueDate,'2026-10-01');
 assert.throws(()=>validateData('tasks',{dueDate:'tomorrow'}));
});
test('createdBy never grants assigned work visibility',()=>{
 assert.equal(canRead(ctx('user'),'projects',{createdBy:'u1',assignedTo:'other'}),false);
 assert.equal(canWrite(ctx('user'),'employees','create',{}),false);
});
test('task dependency graph rejects missing dependencies and cycles',()=>{
 assert.throws(()=>validateData('projects',{tasks:[{id:'a',name:'A',status:'pending',dependencyIds:['b']}]}));
 assert.throws(()=>validateData('projects',{tasks:[{id:'a',name:'A',status:'pending',dependencyIds:['b']},{id:'b',name:'B',status:'pending',dependencyIds:['a']}]}));
 assert.equal(validateData('projects',{tasks:[{id:'a',name:'A',status:'pending'},{id:'b',name:'B',status:'pending',dependencyIds:['a']}]}).tasks.length,2);
});
test('invalid calendar date rejects instead of rolling into next month',()=>assert.throws(()=>validateData('tasks',{dueDate:'2026-02-31'})));
test('milestone and renewal statuses use strict workflow values',()=>{
 assert.throws(()=>validateData('milestones',{status:'paid'}));
 assert.throws(()=>validateData('renewals',{status:'active'}));
 assert.equal(validateData('milestones',{status:'completed'}).status,'completed');
});
test('tender approvals and evaluation are management-only',()=>{
 assert.equal(canWrite(ctx('user'),'tenders','update',{assignedTo:'u1'},{evaluationNotes:'private'}),false);
 assert.equal(canWrite(ctx('user'),'tenders','update',{assignedTo:'u1'},{approvalSteps:[]}),false);
 assert.equal(canWrite(ctx('manager'),'tenders','update',{}, {approvalSteps:[]}),true);
 assert.throws(()=>validateData('tenders',{approvalSteps:[{id:'a',label:'Review',status:'unknown'}]}));
});
test('workspace money compatibility supports only two-decimal currencies',()=>{
 assert.throws(()=>validateData('invoices',{currency:'JPY'}));
 assert.equal(validateData('invoices',{currency:'AED'}).currency,'AED');
});
test('tender checklists support UI objects and AI strings',()=>{
 assert.equal(validateData('tenders',{checklist:['one',{id:'two',text:'two',completed:false}]}).checklist.length,2);
});
