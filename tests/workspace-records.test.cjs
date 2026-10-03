const test=require('node:test');const assert=require('node:assert/strict');
const ts=require('typescript'),fs=require('node:fs');
function load(){const module={exports:{}};const source=fs.readFileSync('src/lib/workspace-records.ts','utf8');new Function('module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(module,module.exports);return module.exports;}
test('workspace data guard accepts only the selected workspace, including employee details',()=>{
 const {assertWorkspaceRecords}=load();const rows=[{id:'employee',workspaceId:'grow'}];
 assert.deepEqual(assertWorkspaceRecords('grow',rows),rows);
 assert.throws(()=>assertWorkspaceRecords('grow',[{id:'employee',workspaceId:'sadeem'}]),/workspace/i);
 assert.throws(()=>assertWorkspaceRecords('grow',[{id:'employee'}]),/workspace/i);
 assert.throws(()=>assertWorkspaceRecords('',rows),/workspace/i);
});
