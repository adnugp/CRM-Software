const WebSocket = require('ws');

let ws = new WebSocket('ws://localhost:3001');

ws.on('open', () => {
  console.log('🔗 Connected to server');
  ws.send(JSON.stringify({
    type: 'chat',
    message: 'Ajumal Contact details',
    sessionId: 'test'
  }));
});

ws.on('message', (data) => {
  console.log('📦 Raw data received:', data.toString());
  console.log('📦 Data type:', typeof data);
  console.log('📦 Data length:', data.length);
  
  try {
    const resp = JSON.parse(data);
    console.log('📝 Parsed response:', resp);
    console.log('📝 Response type:', resp.type);
    console.log('📝 Response content:', resp.response);
  } catch (e) {
    console.log('❌ JSON parse error:', e.message);
    console.log('❌ Raw response:', data.toString());
  }
  
  ws.close();
});

ws.on('error', (e) => console.log('❌ WebSocket error:', e.message));
ws.on('close', () => console.log('🔌 WebSocket closed'));

setTimeout(() => { 
  if (ws.readyState === 1) { 
    console.log('⏰ Connection timeout'); 
    ws.close(); 
  } 
}, 5000);
