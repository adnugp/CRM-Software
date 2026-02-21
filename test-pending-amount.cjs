const WebSocket = require('ws');

let ws = new WebSocket('ws://localhost:3001');

ws.on('open', () => {
  console.log('🔗 Connected to server');
  ws.send(JSON.stringify({
    type: 'chat',
    message: 'pending amount',
    sessionId: 'test'
  }));
});

ws.on('message', (data) => {
  const resp = JSON.parse(data);
  console.log('📝 Response:', resp.response);
  if (resp.type === 'chat_response') {
    ws.close();
  }
});

ws.on('error', (e) => console.log('❌ WebSocket error:', e.message));
ws.on('close', () => console.log('🔌 WebSocket closed'));

setTimeout(() => { 
  if (ws.readyState === 1) { 
    console.log('⏰ Connection timeout after 10 seconds'); 
    ws.close(); 
  } 
}, 10000);
