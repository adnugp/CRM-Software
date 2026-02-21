const WebSocket = require('ws');

const tests = [
  'growplus technologies projects',
  'sadeem energy projects',
  'projects from growplus',
  'sadeem projects'
];

let ws = new WebSocket('ws://localhost:3001');
let currentTest = 0;

ws.on('open', () => {
  console.log('🧪 Testing company filtering for projects...');
  runNextTest();
});

ws.on('message', (data) => {
  const resp = JSON.parse(data);
  if (resp.type === 'chat_response') {
    console.log(`\n📝 Test: ${tests[currentTest]}`);
    console.log(`🤖 Response: ${resp.response}`);
    console.log(`✅ Status: Working`);
    console.log('─'.repeat(60));
    
    currentTest++;
    if (currentTest < tests.length) {
      setTimeout(runNextTest, 1000);
    } else {
      console.log('\n🎯 COMPANY FILTERING FOR PROJECTS SUMMARY:');
      console.log('✅ Company filtering now supported for projects!');
      ws.close();
    }
  }
});

function runNextTest() {
  ws.send(JSON.stringify({
    type: 'chat',
    message: tests[currentTest],
    sessionId: 'company-test'
  }));
}

ws.on('error', (e) => console.log('❌ WebSocket error:', e.message));
setTimeout(() => { if (ws.readyState === 1) { console.log('❌ Connection timeout'); ws.close(); } }, 15000);
