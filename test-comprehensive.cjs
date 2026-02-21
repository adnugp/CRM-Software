const WebSocket = require('ws');

const questions = [
  'how many tenders do we have?',
  'show me open tenders',
  'what projects is ajumal working on?',
  'completed projects',
  'pending payments',
  'active employees in engineering',
  'adnan contact details',
  'pdf files',
  'archived files',
  'commercial registrations',
  'dubai police registrations',
  'how many total employees?',
  'overdue payments',
  'in-progress projects',
  'ismayil tenders',
  'active registrations',
  'files larger than 1MB',
  'employees in sales department',
  'payments from microsoft',
  'urgent tenders'
];

let ws = new WebSocket('ws://localhost:3001');
let currentQuestion = 0;
let responses = [];

ws.on('open', () => {
  console.log('🚀 Starting comprehensive CRM chatbot test...');
  askNextQuestion();
});

ws.on('message', (data) => {
  const resp = JSON.parse(data);
  if (resp.type === 'chat_response') {
    responses.push({
      question: questions[currentQuestion],
      response: resp.response,
      success: !resp.response.includes('error') && !resp.response.includes('apologize')
    });
    console.log(`\n📝 Q${currentQuestion + 1}: ${questions[currentQuestion]}`);
    console.log(`🤖 Response: ${resp.response}`);
    console.log(`✅ Status: ${responses[responses.length - 1].success ? 'SUCCESS' : 'FAILED'}`);
    console.log('─'.repeat(80));
    
    currentQuestion++;
    if (currentQuestion < questions.length) {
      setTimeout(askNextQuestion, 1000);
    } else {
      console.log('\n📊 TEST SUMMARY:');
      console.log(`Total Questions: ${questions.length}`);
      console.log(`Successful Responses: ${responses.filter(r => r.success).length}`);
      console.log(`Success Rate: ${Math.round((responses.filter(r => r.success).length / questions.length) * 100)}%`);
      ws.close();
    }
  }
});

function askNextQuestion() {
  ws.send(JSON.stringify({
    type: 'chat',
    message: questions[currentQuestion],
    sessionId: 'comprehensive-test'
  }));
}

ws.on('error', (e) => console.log('❌ WebSocket error:', e.message));
setTimeout(() => { if (ws.readyState === 1) { console.log('❌ Connection timeout'); ws.close(); } }, 30000);
