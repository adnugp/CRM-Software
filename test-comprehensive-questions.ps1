# Comprehensive CRM Chatbot Test Script
# Tests many question types to verify accuracy

$WebSocket = Add-Type -AssemblyName System.Web
$ws = New-Object System.Net.WebSockets.ClientWebSocket

# Test questions covering all CRM sections
$questions = @(
    # Employee queries
    "Ajumal Contact details",
    "Mohamed Ajumal phone number",
    "active employees",
    "engineering department employees",
    
    # Project queries  
    "inprogress projects",
    "completed projects", 
    "on hold projects",
    "ajumal projects",
    "growplus technologies projects",
    "sadeem energy projects",
    
    # Payment queries
    "pending amount",
    "total pending amount", 
    "paid payments",
    "overdue payments",
    "microsoft payments",
    
    # Tender queries
    "open tenders",
    "submitted tenders",
    "awarded tenders",
    "on hold tenders",
    
    # File queries
    "pdf files",
    "archived files", 
    "files larger than 1MB",
    "report files",
    "documents",
    "images",
    
    # Registration queries
    "commercial license",
    "business license",
    "active registrations",
    "expired registrations",
    
    # Partner queries
    "technology partners",
    "partners",
    
    # Count queries
    "how many employees",
    "how many projects", 
    "how many payments",
    "total employees",
    "total projects"
)

Write-Host "🧪 Starting Comprehensive CRM Chatbot Test..." -ForegroundColor Green
Write-Host "Testing $($questions.Count) questions..." -ForegroundColor Yellow

$results = @()
$currentTest = 0

foreach ($question in $questions) {
    $currentTest++
    Write-Host "`n📝 [$currentTest/$($questions.Count)] Testing: $question" -ForegroundColor Cyan
    
    try {
        # Create WebSocket connection
        $ws = New-Object System.Net.WebSockets.ClientWebSocket
        $cts = New-Object System.Threading.CancellationTokenSource
        
        # Connect to server
        $uri = New-Object System.Uri("ws://localhost:3001")
        $ws.ConnectAsync($uri, $cts.Token).Wait()
        
        # Send message
        $message = @{
            type = "chat"
            message = $question
            sessionId = "test-$currentTest"
        } | ConvertTo-Json -Compress
        
        $buffer = [System.Text.Encoding]::UTF8.GetBytes($message)
        $ws.SendAsync($buffer, 0, $buffer.Length, $cts.Token).Wait()
        
        # Receive response
        $receiveBuffer = New-Object byte[] 4096
        $result = $ws.ReceiveAsync($receiveBuffer, $cts.Token)
        $result.Wait()
        
        if ($result.Result -eq [System.Net.WebSockets.WebSocketReceiveMessageType]::Close) {
            $response = "Connection closed"
        } else {
            $response = [System.Text.Encoding]::UTF8.GetString($receiveBuffer, 0, $result.Count)
            $jsonData = $response | ConvertFrom-Json
            $response = $jsonData.response
        }
        
        $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Test complete", $cts.Token).Wait()
        
        Write-Host "🤖 Response: $response" -ForegroundColor White
        
        # Basic validation
        $isValid = $false
        if ($response -and $response -notlike "*AI fallback*" -and $response -notlike "*error*" -and $response -notlike "*undefined*") {
            $isValid = $true
        }
        
        $results += @{
            Question = $question
            Response = $response
            Valid = $isValid
        }
        
        if ($isValid) {
            Write-Host "✅ Status: VALID" -ForegroundColor Green
        } else {
            Write-Host "❌ Status: INVALID - Needs fixing" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        $results += @{
            Question = $question
            Response = "Error: $($_.Exception.Message)"
            Valid = $false
        }
    }
    
    Write-Host "─" * 60 -ForegroundColor Gray
    Start-Sleep -Milliseconds 500
}

# Summary
Write-Host "`n🎯 COMPREHENSIVE TEST SUMMARY:" -ForegroundColor Magenta
$validCount = ($results | Where-Object { $_.Valid -eq $true }).Count
$invalidCount = ($results | Where-Object { $_.Valid -eq $false }).Count

Write-Host "✅ Valid Responses: $validCount/$($questions.Count)" -ForegroundColor Green
Write-Host "❌ Invalid Responses: $invalidCount/$($questions.Count)" -ForegroundColor Red

if ($invalidCount -gt 0) {
    Write-Host "`n🔧 QUESTIONS NEEDING FIXES:" -ForegroundColor Yellow
    $results | Where-Object { $_.Valid -eq $false } | ForEach-Object {
        Write-Host "❌ $($_.Question)" -ForegroundColor Red
        Write-Host "   Response: $($_.Response)" -ForegroundColor Gray
    }
} else {
    Write-Host "`n🎉 ALL QUESTIONS WORKING PERFECTLY!" -ForegroundColor Green
}

Write-Host "`n📊 Test completed. Review results above for any issues." -ForegroundColor Cyan
