# 🤖 AI Chatbot Widget for CRM Platform

A next-level AI chatbot widget that provides intelligent, context-aware assistance for CRM platforms using local AI processing and vector database technology.

## ✨ Key Features

### 🎯 Widget Design & UX
- **Professional UI**: Modern CRM aesthetics with clean, non-distracting design
- **Smart Positioning**: Bottom-right corner button that expands to full chat overlay
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Interactive Elements**: Typing indicators, message timestamps, scrollable history
- **Flexible States**: Button, expanded, and minimized modes

### 🧠 AI Intelligence
- **CRM-Only Responses**: AI answers exclusively using your CRM data
- **Context Awareness**: Maintains conversation flow and references previous messages
- **Smart Suggestions**: Proactive recommendations based on CRM data analysis
- **Actionable Insights**: "View Deal", "Update Ticket", "Assign Task" buttons

### 🔧 Technical Architecture
- **Local AI Processing**: Uses Ollama for complete data privacy
- **Vector Database**: ChromaDB for fast, semantic CRM data retrieval
- **Real-time Communication**: WebSocket connections for instant messaging
- **Modular Design**: Easily pluggable into any React CRM dashboard

## 🚀 Quick Start

### Prerequisites
1. **Node.js** (v18+)
2. **Ollama** installed and running
3. **Llama2** model pulled (`ollama pull llama2`)

### One-Click Startup
```bash
# Run the automated startup script
start-ai-chatbot.bat
```

### Manual Setup
```bash
# 1. Start Backend
cd ai-chat-backend
npm install
npm run dev

# 2. Start Frontend (in new terminal)
cd ..
npm run dev

# 3. Access the CRM
# Frontend: http://localhost:5173
# AI Chatbot: Look for blue "Chat AI" button in bottom-right
```

## 📁 Project Structure

```
CRM-Software/
├── ai-chat-backend/          # Node.js + Express backend
│   ├── server.js            # Main server with WebSocket support
│   ├── package.json         # Backend dependencies
│   └── .env                 # Environment configuration
├── src/
│   └── components/
│       └── AIChatbotWidget.tsx  # React chatbot component
├── AI_CHATBOT_SETUP.md      # Detailed setup guide
├── README_AI_CHATBOT.md     # This file
├── start-ai-chatbot.bat     # Automated startup script
└── test-ai-chatbot.html     # System testing interface
```

## 🎮 How to Use

### 1. Access the Chatbot
- Open your CRM dashboard at `http://localhost:5173`
- Look for the blue **"Chat AI"** button in the bottom-right corner
- Click to expand the full chat interface

### 2. Ask Questions
Try these example queries:
- *"Show me all active contacts"*
- *"What deals are in negotiation stage?"*
- *"Which contacts haven't been contacted recently?"*
- *"What high-priority tickets are open?"*
- *"Summarize my pipeline value"*

### 3. Use Actionable Suggestions
- Click on suggestion buttons that appear below AI responses
- Examples: "Follow up with John Doe", "Push to close Enterprise Deal"
- Actions are logged and confirmed by the AI

### 4. Chat Features
- **Minimize**: Reduce chat to small status bar
- **Close**: Return to button mode
- **Real-time**: See typing indicators and instant responses
- **Context**: AI remembers conversation history

## 🔧 Configuration

### Environment Variables (.env)
```env
# Server
PORT=3001
NODE_ENV=development

# Ollama AI
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# CRM Integration
CRM_API_URL=http://localhost:8000
CRM_API_KEY=your_crm_api_key

# Vector Database
CHROMA_PERSIST_DIRECTORY=./chroma_db
CHROMA_COLLECTION_NAME=crm_data
```

### Customizing CRM Data
Replace mock data in `server.js` with your actual CRM API:

```javascript
// Example: Replace with your API calls
async function fetchCRMData() {
  const contacts = await axios.get(`${process.env.CRM_API_URL}/contacts`, {
    headers: { 'Authorization': `Bearer ${process.env.CRM_API_KEY}` }
  });
  return contacts.data;
}
```

## 🎨 UI Customization

### Colors and Styling
Edit `AIChatbotWidget.tsx`:

```typescript
// Change primary color
className="bg-blue-600 hover:bg-blue-700"  // Change to your brand colors

// Adjust dimensions
className="w-96 h-[600px]"  // Modify width and height
```

### Brand Integration
```typescript
// Update logo and text
<Bot className="w-5 h-5 text-blue-600" />  // Your brand icon
<CardTitle className="text-lg font-semibold">Your AI Assistant</CardTitle>
```

## 🔌 API Reference

### WebSocket Events

#### Client → Server
```javascript
// Send chat message
{
  type: 'chat',
  message: 'Show me active deals',
  sessionId: 'uuid-here'
}

// Execute action
{
  type: 'action',
  action: 'update_deal',
  data: { dealId: '123', status: 'won' }
}
```

#### Server → Client
```javascript
// AI response
{
  type: 'chat_response',
  response: 'You have 5 active deals...',
  suggestions: [
    { text: 'Follow up on Enterprise Deal', action: 'contact', data: {...} }
  ],
  sources: [{ type: 'deal', data: {...} }]
}

// Action confirmation
{
  type: 'action_response',
  message: 'Deal updated successfully'
}
```

### REST Endpoints
- `GET /api/health` - System health check
- `GET /api/crm/summary` - CRM data overview
- `POST /api/crm/search` - Search CRM data

## 🧪 Testing

### Automated Testing
Open `test-ai-chatbot.html` in your browser to:
- Check system status (Ollama, Backend, Frontend)
- Test API endpoints
- Verify WebSocket connectivity
- Run performance benchmarks

### Manual Testing Checklist
- [ ] Chatbot button appears in bottom-right
- [ ] Clicking expands to full chat interface
- [ ] Messages send and receive correctly
- [ ] AI responses are CRM-data only
- [ ] Suggestion buttons work
- [ ] Minimize/close functions work
- [ ] Mobile responsiveness
- [ ] Error handling for disconnections

## 🔒 Security Considerations

### Data Privacy
- ✅ All AI processing happens locally via Ollama
- ✅ CRM data never leaves your infrastructure
- ✅ No external API calls for AI processing
- ✅ Vector database stored locally

### Access Control
- Implement authentication in your CRM
- Use role-based access for chat features
- Log all AI interactions for audit trails
- Validate all user inputs

## 🚀 Deployment

### Production Setup
```bash
# Backend
cd ai-chat-backend
npm ci --only=production
pm2 start server.js --name crm-ai-chat

# Frontend
npm run build
# Deploy build/ folder to your web server
```

### Docker Deployment
```dockerfile
# Backend Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## 🎯 Advanced Features

### Smart Suggestions System
The AI automatically generates contextual suggestions:
- **Follow-up reminders** for uncontacted leads
- **Deal closing prompts** for high-probability opportunities
- **Task assignments** for overdue activities
- **Ticket escalations** for high-priority issues

### Real-time Data Sync
- Automatic CRM data reindexing every 6 hours
- WebSocket connections for instant updates
- Context preservation across sessions
- Intelligent caching for performance

### Multi-language Support
Easily extend for different languages:
```javascript
const prompts = {
  en: "You are a helpful CRM assistant...",
  es: "Eres un asistente útil de CRM...",
  fr: "Vous êtes un assistant CRM utile..."
};
```

## 🛠️ Troubleshooting

### Common Issues

**Ollama Connection Failed**
```bash
# Check if Ollama is running
ollama list

# Start Ollama
ollama serve

# Pull required model
ollama pull llama2
```

**Backend Not Responding**
```bash
# Check if port 3001 is available
netstat -an | grep 3001

# Restart backend
cd ai-chat-backend
npm run dev
```

**WebSocket Connection Issues**
- Verify CORS configuration in `.env`
- Check firewall settings
- Ensure both frontend and backend are running

### Debug Mode
Enable detailed logging:
```javascript
// In server.js
const DEBUG = true;
if (DEBUG) console.log('Debug:', data);
```

## 📈 Performance Optimization

### Vector Database Tuning
- Increase `nResults` for better search accuracy
- Implement data caching for frequent queries
- Use batch processing for large datasets

### Frontend Optimization
- Virtual scrolling for long chat histories
- React.memo for component optimization
- Debounced input to reduce API calls

### AI Response Optimization
- Limit context length for faster processing
- Implement response caching for common queries
- Use streaming responses for better UX

## 🤝 Contributing

### Adding New CRM Integrations
1. Create adapter for your CRM API
2. Update data indexing functions
3. Test with mock data first
4. Deploy with proper authentication

### Extending AI Capabilities
1. Add new prompt templates
2. Implement custom action handlers
3. Enhance suggestion algorithms
4. Add analytics and reporting

## 📞 Support

For issues and questions:
1. Check the troubleshooting section above
2. Run the test suite (`test-ai-chatbot.html`)
3. Review console logs for detailed errors
4. Verify all environment configurations

---

## 🎉 You're Ready!

Your AI chatbot widget is now integrated into your CRM platform. The system provides:

- **Intelligent CRM assistance** powered by local AI
- **Real-time, context-aware conversations**
- **Actionable insights and suggestions**
- **Professional, modern UI** that matches CRM aesthetics
- **Complete data privacy** with local processing

The chatbot will appear as a blue "Chat AI" button in the bottom-right corner of your CRM interface, ready to help users with contacts, deals, activities, and tickets using only your CRM data.

**Next Steps:**
1. Customize the CRM data integration
2. Adjust UI colors to match your brand
3. Add user authentication
4. Deploy to production
5. Train users on the new AI assistant

Enjoy your enhanced CRM platform! 🚀
