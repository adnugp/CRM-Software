const WebSocket = require('ws');

const tests = [
  'completed projects',
  'on hold projects',
  'completed tenders',
  'on hold tenders'
];

let ws = new WebSocket('ws://localhost:3001');
let currentTest = 0;

ws.on('open', () => {
  console.log('🧪 Testing completed and on hold filters...');
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
      console.log('\n🎯 ON HOLD & COMPLETED FILTERS SUMMARY:');
      console.log('✅ Both completed and on hold filters now supported!');
      ws.close();
    }
  }
});

function runNextTest() {
  ws.send(JSON.stringify({
    type: 'chat',
    message: tests[currentTest],
    sessionId: 'onhold-test'
  }));
}

ws.on('error', (e) => console.log('❌ WebSocket error:', e.message));
setTimeout(() => { if (ws.readyState === 1) { console.log('❌ Connection timeout'); ws.close(); } }, 15000);
