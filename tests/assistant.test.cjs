const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');const Module=require('node:module');
const filename=require('node:path').resolve('src/lib/assistant.ts');
const loaded=new Module(filename,module);loaded.filename=filename;loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,filename);
const {assistantRetry,isAssistantQuickPrompt,assistantSuggestionsPrompt}=loaded.exports;
test('retry helper preserves provider/request distinction and bounds untrusted delay',()=>{
  assert.deepEqual(assistantRetry(new Error('other')),{});
  assert.deepEqual(assistantRetry({cause:{details:{scope:'provider',retryAfterSeconds:42}}}),{scope:'provider',seconds:42});
  assert.deepEqual(assistantRetry({cause:{details:{scope:'workspace'}}}),{scope:'workspace'});
  assert.equal(assistantRetry({cause:{details:{scope:'provider',retryAfterSeconds:99999}}}).seconds,3600);
});
test('only exact CRM reads remain eligible during hosted rate limits',()=>{
  for(const prompt of ['Show daily briefing','Show project risks','Show my upcoming deadlines'])assert.equal(isAssistantQuickPrompt(prompt),true);
  for(const prompt of ['Show daily briefing and create tasks','Draft a payment reminder','Who is assigned?'])assert.equal(isAssistantQuickPrompt(prompt),false);
});
test('workspace actions use selected real record identities and keep drafts unsent',()=>{
  const choice={id:'sadeem-customer',name:'Sadeem Commercial Facilities'};
  assert.match(assistantSuggestionsPrompt('customers',choice),/Sadeem Commercial Facilities.*sadeem-customer/);
  assert.match(assistantSuggestionsPrompt('customers',choice),/do not send/i);
  assert.match(assistantSuggestionsPrompt('invoices',choice),/outstanding balance and currency/);
  assert.match(assistantSuggestionsPrompt('files',choice),/page\/sheet sources/);
  assert.match(assistantSuggestionsPrompt('tenders',choice),/ask before replacing/);
});
