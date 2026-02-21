const WebSocket = require('ws');

// Test questions covering all CRM sections
const questions = [
    // Employee queries
    "Ajumal Contact details",
    "Mohamed Ajumal phone number", 
    "active employees",
    "engineering department employees",
    
    // Project queries  
    "inprogress projects",
    "completed projects", 
    "on hold projects",
    "ajumal projects",
    "growplus technologies projects",
    "sadeem energy projects",
    
    // Payment queries
    "pending amount",
    "total pending amount", 
    "paid payments",
    "overdue payments",
    "microsoft payments",
    
    // Tender queries
    "open tenders",
    "submitted tenders",
    "awarded tenders",
    "on hold tenders",
    
    // File queries
    "pdf files",
    "archived files", 
    "files larger than 1MB",
    "report files",
    "documents",
    "images",
    
    // Registration queries
    "commercial license",
    "business license",
    "active registrations",
    "expired registrations",
    
    // Partner queries
    "technology partners",
    "partners",
    
    // Count queries
    "how many employees",
    "how many projects", 
    "how many payments",
    "total employees",
    "total projects"
];

console.log('🧪 Starting Comprehensive CRM Chatbot Test...');
console.log(`Testing ${questions.length} questions...`);

const results = [];
let currentTest = 0;

function runNextTest() {
    if (currentTest >= questions.length) {
        showSummary();
        return;
    }
    
    const question = questions[currentTest];
    currentTest++;
    
    console.log(`\n📝 [${currentTest}/${questions.length}] Testing: ${question}`);
    
    const ws = new WebSocket('ws://localhost:3001');
    
    ws.on('open', () => {
        ws.send(JSON.stringify({
            type: 'chat',
            message: question,
            sessionId: `test-${currentTest}`
        }));
    });
    
    ws.on('message', (data) => {
        try {
            const resp = JSON.parse(data);
            
            if (resp.type === 'chat_response') {
                const response = resp.response;
                
                console.log(`🤖 Response: ${response}`);
                
                // Basic validation
                const isValid = response && 
                                !response.includes('AI fallback') && 
                                !response.includes('error') && 
                                !response.includes('undefined') &&
                                !response.includes('You have') && // Generic AI responses
                                !response.includes('items in your CRM'); // Generic AI responses
                
                results.push({
                    question: question,
                    response: response,
                    valid: isValid
                });
                
                if (isValid) {
                    console.log('✅ Status: VALID');
                } else {
                    console.log('❌ Status: INVALID - Needs fixing');
                }
                
                console.log('─'.repeat(60));
                ws.close();
                
                setTimeout(runNextTest, 500);
            }
        } catch (e) {
            console.log(`❌ JSON parse error: ${e.message}`);
            results.push({
                question: question,
                response: `Error: ${e.message}`,
                valid: false
            });
            
            console.log('─'.repeat(60));
            ws.close();
            setTimeout(runNextTest, 500);
        }
    });
    
    ws.on('error', (e) => {
        console.log(`❌ Error: ${e.message}`);
        results.push({
            question: question,
            response: `Error: ${e.message}`,
            valid: false
        });
        
        console.log('─'.repeat(60));
        setTimeout(runNextTest, 500);
    });
    
    setTimeout(() => {
        if (ws.readyState === 1) {
            console.log('⏰ Connection timeout');
            results.push({
                question: question,
                response: 'Connection timeout',
                valid: false
            });
            ws.close();
            setTimeout(runNextTest, 500);
        }
    }, 5000);
}

function showSummary() {
    console.log('\n🎯 COMPREHENSIVE TEST SUMMARY:');
    const validCount = results.filter(r => r.valid).length;
    const invalidCount = results.filter(r => !r.valid).length;
    
    console.log(`✅ Valid Responses: ${validCount}/${questions.length}`);
    console.log(`❌ Invalid Responses: ${invalidCount}/${questions.length}`);
    
    if (invalidCount > 0) {
        console.log('\n🔧 QUESTIONS NEEDING FIXES:');
        results.filter(r => !r.valid).forEach(result => {
            console.log(`❌ ${result.question}`);
            console.log(`   Response: ${result.response}`);
        });
    } else {
        console.log('\n🎉 ALL QUESTIONS WORKING PERFECTLY!');
    }
    
    console.log('\n📊 Test completed. Review results above for any issues.');
    process.exit(0);
}

// Start testing
runNextTest();
