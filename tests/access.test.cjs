const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
test('unavailable callable errors identify missing backend and preserve validation messages',()=>{
 const {apiErrorMessage}=load('src/lib/api-errors.ts');
 assert.match(apiErrorMessage({code:'functions/internal',message:'internal'},true),/npm run dev:backend/);
 assert.match(apiErrorMessage({code:'functions/internal',message:'internal'},false),/deployed/);
 assert.equal(apiErrorMessage({code:'functions/invalid-argument',message:'Invalid currency'},true),'Invalid currency');
});
function load(path) {
  const m = new Module(path, module);
  m._compile(ts.transpile(fs.readFileSync(path, 'utf8'), {module: ts.ModuleKind.CommonJS}), path);
  return m.exports;
}
test('client access requires explicit shared identity and matching workspace', () => {
  const {canViewProject} = load('src/lib/project-visibility.ts');
  const client = {id:'u1',role:'client',workspaceId:'w1',company:'Acme'};
  assert.equal(canViewProject(client,{workspaceId:'w1',company:'Acme'}),false);
  assert.equal(canViewProject(client,{workspaceId:'w2',clientId:'u1'}),false);
  assert.equal(canViewProject(client,{workspaceId:'w1',sharedWith:['u1']}),true);
});
test('staff access is restricted to assigned work within the workspace', () => {
  const {canViewProject} = load('src/lib/project-visibility.ts');
  const user = {id:'u1',role:'user',workspaceId:'w1'};
  assert.equal(canViewProject(user,{workspaceId:'w1',assignedTo:'u2'}),false);
  assert.equal(canViewProject(user,{workspaceId:'w1',assignedTo:'u1'}),true);
  assert.equal(canViewProject({...user,role:'admin'},{workspaceId:'w2'}),false);
  assert.equal(canViewProject({...user,role:'manager'},{workspaceId:'w1'}),true);
});
test('report compares equal windows and never invents a zero-baseline growth rate',()=>{
 const {creationWindows}=load('src/lib/reporting.ts');const now=Date.parse('2026-09-30T00:00:00Z'),day=86400000;
 const result=creationWindows([{createdAt:new Date(now-day)},{createdAt:new Date(now-40*day)},{createdAt:'invalid'},{createdAt:new Date(now+day)}],now);
 assert.deepEqual(result,{current:1,previous:1,undated:1,change:0});
 assert.equal(creationWindows([{createdAt:new Date(now-day)}],now).change,undefined);
});
