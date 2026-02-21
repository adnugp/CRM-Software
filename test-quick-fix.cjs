const WebSocket = require('ws');

let ws = new WebSocket('ws://localhost:3001');
let messageCount = 0;

ws.on('open', () => {
  console.log('🔗 Connected to server');
  ws.send(JSON.stringify({
    type: 'chat',
    message: 'Ajumal Contact details',
    sessionId: 'test'
  }));
});

ws.on('message', (data) => {
  messageCount++;
  console.log(`\n📦 Message ${messageCount} received:`, data.toString());
  
  try {
    const resp = JSON.parse(data);
    console.log('📝 Response type:', resp.type);
    
    if (resp.type === 'chat_response') {
      console.log('📝 Chat response:', resp.response);
      ws.close();
    } else if (resp.type === 'connection_established') {
      console.log('📝 Connection established');
    } else {
      console.log('📝 Other response:', resp);
    }
  } catch (e) {
    console.log('❌ JSON parse error:', e.message);
    console.log('❌ Raw response:', data.toString());
  }
});

ws.on('error', (e) => console.log('❌ WebSocket error:', e.message));
ws.on('close', () => console.log('🔌 WebSocket closed'));

setTimeout(() => { 
  if (ws.readyState === 1) { 
    console.log('⏰ Connection timeout - no chat response received'); 
    ws.close(); 
  } 
}, 10000);
