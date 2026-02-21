const WebSocket = require('ws');

const tests = [
  'payments from microsoft',
  'files larger than 1MB',
  'what projects is ajumal working on?'
];

let ws = new WebSocket('ws://localhost:3001');
let currentTest = 0;

ws.on('open', () => {
  console.log('🧪 Testing specific fixes...');
  runNextTest();
});

ws.on('message', (data) => {
  const resp = JSON.parse(data);
  if (resp.type === 'chat_response') {
    console.log(`\n📝 Test: ${tests[currentTest]}`);
    console.log(`🤖 Response: ${resp.response}`);
    console.log(`✅ Status: ${!resp.response.includes('all 4') && !resp.response.includes('Found 4 file(s)') ? 'FIXED' : 'NEEDS WORK'}`);
    console.log('─'.repeat(60));
    
    currentTest++;
    if (currentTest < tests.length) {
      setTimeout(runNextTest, 1000);
    } else {
      console.log('\n🎯 FIXES SUMMARY:');
      ws.close();
    }
  }
});

function runNextTest() {
  ws.send(JSON.stringify({
    type: 'chat',
    message: tests[currentTest],
    sessionId: 'fix-test'
  }));
}

ws.on('error', (e) => console.log('❌ WebSocket error:', e.message));
setTimeout(() => { if (ws.readyState === 1) { console.log('❌ Connection timeout'); ws.close(); } }, 15000);
