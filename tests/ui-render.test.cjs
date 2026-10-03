const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');

let authValue, dataValue;
const TabsContext = React.createContext('overview');
const wrapper = ({children}) => React.createElement('div', null, children);
const mocks = {
  '@/services/api': {callApi:async()=>{throw Error('No live calls in render tests');}},
  '@/services/firestore': {getCollection:async()=>{throw Error('No live calls in render tests');},mutateBusinessRecord:async()=>{throw Error('No live writes in render tests');}},
  '@/contexts/AuthContext': {useAuth: () => authValue},
  '@/contexts/DataContext': {useData: () => dataValue},
  '@/services/documents': {uploadDocument: async () => {throw Error('No upload allowed in render test');}, downloadDocument: async () => {throw Error('No download allowed in render test');}},
  '@/hooks/use-toast': {toast: () => {}},
  '@/components/layout/MainLayout': {default: wrapper},
  '@/components/ui/PageHeader': {default: ({title, description}) => React.createElement('header', null, title, description)},
  '@/components/ui/tabs': {Tabs: ({value, defaultValue, children}) => React.createElement(TabsContext.Provider, {value: value || defaultValue}, children), TabsContent: ({value, children}) => React.useContext(TabsContext) === value ? wrapper({children}) : null, TabsList: wrapper, TabsTrigger: wrapper},
  '@/components/forms/PaymentForm': {default: () => null},
  '@/components/forms/SubscriptionForm': {default: () => null},
  '@/components/ui/PaymentConfirmDialog': {default: () => null},
  '@/components/ui/MultiDocumentUpload': {default: () => null},
  '@/components/ui/StatusBadge': {default: ({status}) => React.createElement('span', null, status)},
  '@/components/ui/alert-dialog': new Proxy({AlertDialog: ({open, children}) => open ? wrapper({children}) : null}, {get: (target, key) => key in target ? target[key] : key === '__esModule' ? true : wrapper}),
  '@/components/ui/dialog': new Proxy({Dialog: ({open, children}) => open ? wrapper({children}) : null}, {get: (target, key) => key in target ? target[key] : key === '__esModule' ? true : wrapper}),
  '@/components/forms/ProjectTaskForm': {default: () => null},
  '@/components/forms/ProjectCostForm': {default: () => null},
  '@/components/projects/ProjectTimeline': {default: () => null},
  '@/components/projects/ProjectLifecycle': {default: () => null},
  'recharts': new Proxy({}, {get: () => wrapper}),
  'jspdf': {jsPDF: class {constructor() {throw Error('No PDF generation in render test');}}},
  'react-router-dom': {useParams: () => ({id: 'selected'}), useSearchParams:()=>[new URLSearchParams('tab=invoices')], Link: wrapper, Navigate: ({to}) => React.createElement('span', {'data-redirect': to})},
};
function load(file) {
  const filename = path.resolve(file);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true}}).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = name => {
    if (mocks[name]) return Object.prototype.hasOwnProperty.call(mocks[name], 'default') ? {...mocks[name], __esModule: true} : mocks[name];
    if (name.startsWith('@/components/ui/')) return new Proxy({}, {get: (_target, key) => key === '__esModule' ? true : wrapper});
    if (name.startsWith('@/')) {
      const stem = path.resolve('src', name.slice(2));
      const local = ['.ts', '.tsx'].map(extension => stem + extension).find(candidate => fs.existsSync(candidate));
      if (!local) throw Error(`Missing test module ${name}`);
      return load(local);
    }
    return require(name);
  };
  loaded._compile(source, filename);
  return loaded.exports;
}
const ProjectManagement = load('src/pages/ProjectManagement.tsx').default;
function render(role, records, extra = {}) {
  authValue = {user: {id: 'viewer', name: 'Viewer', role, workspaceId: 'workspace-one'}, allUsers: [], activeWorkspace: {id: 'workspace-one'}, ...extra};
  dataValue = {projects: records, employees: [], updateProject: async () => {throw Error('No write allowed in render test');}};
  return renderToStaticMarkup(React.createElement(ProjectManagement));
}
const project = {id: 'selected', workspaceId: 'workspace-one', name: 'Visible project', company: 'Customer', belongsTo: 'Division', status: 'running', assignedTo: 'viewer', assignedToName: 'Viewer', deadline: '2026-12-01', sharedWith: ['viewer'], tasks: [], costs: [], budget: 100, currency: 'AED'};
test('missing project renders redirect without runtime null dereference', () => {
  assert.match(render('admin', []), /data-redirect="\/projects"/);
});
test('allowed admin project renders real page title and overview', () => {
  const html = render('admin', [project]);
  assert.match(html, /Visible project/); assert.doesNotMatch(html, /data-redirect/);
});
test('client must have explicit workspace-matching share and cannot see financial controls', () => {
  assert.match(render('client', [{...project, sharedWith: []}]), /data-redirect/);
  assert.match(render('client', [{...project, workspaceId: 'foreign'}]), /data-redirect/);
  const html = render('client', [{...project, budget: undefined, costs: undefined}]);
  assert.match(html, /Visible project/); assert.doesNotMatch(html, /Executive Financial Briefing|Gross Revenue|Record Expense|Financial Summary/);
});
test('employee project authorization requires assignment and anonymous identity redirects', () => {
  assert.match(render('user', [{...project, assignedTo: 'other', assignedUserIds: []}]), /data-redirect/);
  assert.match(render('user', [project]), /Visible project/);
  assert.match(render('admin', [project], {user: null}), /data-redirect/);
});

test('assistant launcher is workspace-scoped and hidden from client accounts',()=>{
 const Assistant=load('src/components/AIChatbotWidget.tsx').default;
 dataValue={refresh:async()=>{}};
 authValue={user:{id:'u',role:'client'},activeWorkspace:{id:'w',name:'Workspace'}};
 assert.equal(renderToStaticMarkup(React.createElement(Assistant)),'');
 authValue={user:{id:'u',role:'admin'},activeWorkspace:{id:'w',name:'Workspace'}};
 assert.match(renderToStaticMarkup(React.createElement(Assistant)),/CRM assistant/);
 authValue={user:{id:'u',role:'admin'},activeWorkspace:null};
 assert.equal(renderToStaticMarkup(React.createElement(Assistant)),'');
});

test('open assistant renders daily briefing, risks and saved-chat controls without old hardcoded examples',()=>{
 let state=0;
 mocks.react={...React,useState:initial=>React.useState(state++===0?true:initial)};
 let Assistant;try{Assistant=load('src/components/AIChatbotWidget.tsx').default;}finally{delete mocks.react;}
 authValue={user:{id:'u',role:'admin'},activeWorkspace:{id:'sadeem',name:'Sadeem Energy'}};dataValue={refresh:async()=>{}};
 const html=renderToStaticMarkup(React.createElement(Assistant));
 assert.match(html,/Show daily briefing/);assert.match(html,/Show project risks/);assert.match(html,/Workspace actions and drafts/);
 assert.doesNotMatch(html,/Palm Tower|Marina District|Sana Ahmed|2026-10-05/);
});
test('workspace action choices render supplied Sadeem records and employee rather than Grow Plus samples',()=>{
 const Actions=load('src/components/AssistantActions.tsx').default;
 const suggestions={records:{projects:[{id:'p',name:'Sadeem Solar Maintenance'}],employees:[{id:'e',name:'Fatima Noor'}],customers:[{id:'c',name:'Sadeem Commercial Facilities'}],invoices:[{id:'i',name:'SADEEM-DEMO-1001'}],files:[{id:'f',name:'Clean tender.pdf'}]},scope:'Authorized records'};
 const html=renderToStaticMarkup(React.createElement(Actions,{suggestions,disabled:false,modelDisabled:false,onAsk:()=>{}}));
 assert.match(html,/Sadeem Solar Maintenance/);assert.match(html,/Fatima Noor/);assert.match(html,/Draft follow-up email|Draft payment reminder|Analyze document/);
 assert.doesNotMatch(html,/Sana Ahmed|Palm Tower/);
});
test('assistant invoice source opens the invoice tab only for management',()=>{
 const Hub=load('src/pages/BusinessHub.tsx').default;
 dataValue={projects:[],tenders:[],payments:[],registrations:[]};
 authValue={user:{id:'u',role:'admin'},activeWorkspace:{id:'w',currency:'AED'}};
 assert.match(renderToStaticMarkup(React.createElement(Hub)),/Invoice reference/);
 authValue={user:{id:'u',role:'user'},activeWorkspace:{id:'w',currency:'AED'}};
 const html=renderToStaticMarkup(React.createElement(Hub));
 assert.doesNotMatch(html,/Invoice reference/);assert.match(html,/Add customer/);
});

const Payments = load('src/pages/Payments.tsx').default;
function renderPayments(role, payments, subscriptions = [], errors = {}) {
  authValue = {user: {role}, activeWorkspace: {id: 'workspace-one', currency: 'AED'}};
  dataValue = {payments, subscriptions, loading: {}, errors, refresh: async () => {}};
  return renderToStaticMarkup(React.createElement(Payments));
}
test('payments page renders real invoice receipt schema without crashing or editable receipt actions', () => {
  const html = renderPayments('admin', [{id:'receipt', invoiceId:'INV-001', amountMinor:1500000, currency:'AED', date:'2026-10-01', status:'paid'}]);
  assert.match(html, /AED 15,000\.00/);
  assert.match(html, /INV-001/);
  assert.match(html, /Invoice receipt/);
  assert.doesNotMatch(html, /Invalid Date|NaN|lucide-pencil|Mark Paid/);
});
test('subscription summary reads minor units and annual billing as monthly equivalent', () => {
  const html = renderPayments('admin', [], [{id:'monthly', amountMinor:49900, billingCycle:'monthly', status:'active'}, {id:'annual', amountMinor:120000, billingCycle:'yearly', status:'active'}, {id:'cancelled', amount:200, billingCycle:'monthly', status:'cancelled'}]);
  assert.match(html, /AED 599\.00\/mo/);
  assert.doesNotMatch(html, /NaN/);
});
test('payments totals keep currencies separate and do not assume a VAT charge', () => {
  const html = renderPayments('admin', [{id:'p1', amount:50, currency:'USD', status:'pending'}, {id:'p2', amount:100, currency:'AED', status:'pending'}]);
  assert.match(html, /USD 50\.00/); assert.match(html, /AED 100\.00/);
  assert.doesNotMatch(html, /VAT \(5%\)|NaN|Invalid Date/);
});
test('payments page explains unavailable employee access and exposes loading failures', () => {
  assert.match(renderPayments('user', []), /administrator or manager/);
  assert.doesNotMatch(renderPayments('user', []), /Add Payment|Add Subscription/);
  assert.match(renderPayments('admin', [], [], {payments:'Payments could not load'}), /Payments could not load/);
});

for (const name of ['Payment', 'Subscription']) {
  test(`${name} form waits for save success and remains open on failure`, async () => {
    const stateChanges = [];
    mocks.react = {...React, useEffect: () => {}, useState: initial => [initial, value => stateChanges.push(value)]};
    let Form;
    try { Form = load(`src/components/forms/${name}Form.tsx`).default; } finally { delete mocks.react; }
    const findForm = element => {
      if (!element || typeof element !== 'object') return null;
      if (element.type === 'form') return element;
      return React.Children.toArray(element.props?.children).map(findForm).find(Boolean);
    };
    const closed = [];
    let finish;
    const pending = new Promise(resolve => {finish = resolve;});
    const form = findForm(Form({open:true, onOpenChange:value=>closed.push(value), onSubmit:()=>pending}));
    const saving = form.props.onSubmit({preventDefault(){}});
    assert.deepEqual(closed, []);
    finish(); await saving;
    assert.deepEqual(closed, [false]);
    closed.length = 0;
    const failed = findForm(Form({open:true, onOpenChange:value=>closed.push(value), onSubmit:async()=>{throw Error('Save failed');}}));
    await failed.props.onSubmit({preventDefault(){}});
    assert.deepEqual(closed, []);
    assert.ok(stateChanges.includes('Save failed'));
  });
}
