import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import {
  MessageCircle,
  X,
  Minimize2,
  Send,
  Bot,
  User,
  AlertCircle,
  CheckCircle,
  Copy,
  Download,
  ChevronDown,
  ChevronUp,
  Share2,
  Plus,
  Smile,
  ArrowUp,
  MoreHorizontal
} from 'lucide-react';
import Lottie from 'lottie-react';
import chatbotAnimation from '@/assets/Hello Chat Bot Super Clean.json';
import robotIcon from '@/assets/robot.png';
import userIcon from '@/assets/user-removebg-preview.png';
import { cn } from '@/lib/utils';

// Memoized custom styles to prevent re-injection
const getCustomStyles = () => `
  @keyframes slideInUp {
    from {
      transform: translateY(100%) scale(0.8);
      opacity: 0;
    }
    to {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }
  
  @keyframes slideInLeft {
    from {
      transform: translateX(-50px) scale(0.9);
      opacity: 0;
    }
    to {
      transform: translateX(0) scale(1);
      opacity: 1;
    }
  }
  
  @keyframes slideInRight {
    from {
      transform: translateX(50px) scale(0.9);
      opacity: 0;
    }
    to {
      transform: translateX(0) scale(1);
      opacity: 1;
    }
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  @keyframes bounceIn {
    0% {
      transform: scale(0.3);
      opacity: 0;
    }
    50% {
      transform: scale(1.05);
    }
    70% {
      transform: scale(0.9);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  @keyframes minimize {
    0% {
      transform: scale(1) translateY(0);
      opacity: 1;
    }
    100% {
      transform: scale(0.3) translateY(20px);
      opacity: 0;
    }
  }
  
  @keyframes expand {
    0% {
      transform: scale(0.3) translateY(20px);
      opacity: 0;
    }
    100% {
      transform: scale(1) translateY(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    0% {
      transform: scale(1) translateY(0);
      opacity: 1;
    }
    30% {
      transform: scale(1.1) translateY(-5px);
      opacity: 1;
    }
    100% {
      transform: scale(0.8) translateY(50px);
      opacity: 0;
    }
  }
  
  @keyframes elegantIn {
    0% {
      transform: scale(0.3) rotate(12deg) translateY(30px);
      opacity: 0;
      filter: blur(3px);
    }
    25% {
      transform: scale(0.6) rotate(9deg) translateY(20px);
      opacity: 0.3;
      filter: blur(1.2px);
    }
    50% {
      transform: scale(0.8) rotate(6deg) translateY(12px);
      opacity: 0.6;
      filter: blur(0.6px);
    }
    75% {
      transform: scale(0.9) rotate(3deg) translateY(5px);
      opacity: 0.9;
      filter: blur(0.2px);
    }
    100% {
      transform: scale(1) rotate(0deg) translateY(0px);
      opacity: 1;
      filter: blur(0px);
    }
  }
  
  @keyframes elegantOut {
    0% {
      transform: scale(1) rotate(0deg) translateY(0px);
      opacity: 1;
      filter: blur(0px);
    }
    25% {
      transform: scale(0.9) rotate(-3deg) translateY(-5px);
      opacity: 0.9;
      filter: blur(0.2px);
    }
    50% {
      transform: scale(0.8) rotate(-6deg) translateY(-12px);
      opacity: 0.6;
      filter: blur(0.6px);
    }
    75% {
      transform: scale(0.6) rotate(-9deg) translateY(-20px);
      opacity: 0.3;
      filter: blur(1.2px);
    }
    100% {
      transform: scale(0.3) rotate(-12deg) translateY(-30px);
      opacity: 0;
      filter: blur(3px);
    }
  }
  
  @keyframes testPulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.3);
    }
  }
  
  @keyframes glow {
    0% {
      box-shadow: 0 0 5px rgba(34, 197, 94, 0.3);
    }
    50% {
      box-shadow: 0 0 20px rgba(34, 197, 94, 0.6), 0 0 30px rgba(34, 197, 94, 0.4);
    }
    100% {
      box-shadow: 0 0 5px rgba(34, 197, 94, 0.3);
    }
  }
  
  @keyframes float {
    0%, 100% {
      transform: translateY(0px) translateX(0px);
    }
    25% {
      transform: translateY(-5px) translateX(3px);
    }
    50% {
      transform: translateY(-8px) translateX(-2px);
    }
    75% {
      transform: translateY(-3px) translateX(2px);
    }
  }
  
  @keyframes float-delayed {
    0%, 100% {
      transform: translateY(0px) translateX(0px);
    }
    33% {
      transform: translateY(-6px) translateX(-4px);
    }
    66% {
      transform: translateY(-4px) translateX(3px);
    }
  }
  
  @keyframes float-slow {
    0%, 100% {
      transform: translateY(0px) translateX(0px);
    }
    50% {
      transform: translateY(-7px) translateX(-3px);
    }
  }
  
  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
  
  @keyframes spin-slow {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  
  @keyframes float-1 {
    0%, 100% {
      transform: translate(0px, 0px);
      opacity: 0.6;
    }
    33% {
      transform: translate(5px, -8px);
      opacity: 0.8;
    }
    66% {
      transform: translate(-3px, -12px);
      opacity: 0.4;
    }
  }
  
  @keyframes float-2 {
    0%, 100% {
      transform: translate(0px, 0px);
      opacity: 0.4;
    }
    33% {
      transform: translate(-6px, -6px);
      opacity: 0.6;
    }
    66% {
      transform: translate(4px, -10px);
      opacity: 0.8;
    }
  }
  
  @keyframes float-3 {
    0%, 100% {
      transform: translate(0px, 0px);
      opacity: 0.5;
    }
    33% {
      transform: translate(8px, -4px);
      opacity: 0.7;
    }
    66% {
      transform: translate(-5px, -8px);
      opacity: 0.3;
    }
  }
  
  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }
  
  .animate-slideInUp {
    animation: slideInUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  
  .animate-slideInLeft {
    animation: slideInLeft 0.3s ease-out;
  }
  
  .animate-slideInRight {
    animation: slideInRight 0.3s ease-out;
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.2s ease-out;
  }
  
  .animate-bounceIn {
    animation: bounceIn 0.5s ease-out;
  }
  
  .animate-minimize {
    animation: minimize 0.3s ease-in forwards;
  }
  
  .animate-expand {
    animation: expand 0.3s ease-out forwards;
  }
  
  .animate-slideOut {
    animation: slideOut 0.4s ease-in forwards;
  }
  
  .animate-elegantIn {
    animation: elegantIn 2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
  
  .animate-elegantOut {
    animation: elegantOut 2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
  
  .animate-testPulse {
    animation: testPulse 0.3s ease-in-out infinite;
  }
  
  .animate-glow {
    animation: glow 2s ease-in-out infinite;
  }
  
  .animate-float {
    animation: float 3s ease-in-out infinite;
  }
  
  .animate-float-delayed {
    animation: float-delayed 3.5s ease-in-out infinite;
  }
  
  .animate-float-slow {
    animation: float-slow 4s ease-in-out infinite;
  }
  
  .animate-shimmer {
    animation: shimmer 2s ease-in-out infinite;
  }
  
  .animate-spin-slow {
    animation: spin-slow 4s linear infinite;
  }
  
  .animate-float-1 {
    animation: float-1 4s ease-in-out infinite;
  }
  
  .animate-float-2 {
    animation: float-2 3.5s ease-in-out infinite;
  }
  
  .animate-float-3 {
    animation: float-3 4.5s ease-in-out infinite;
  }
  
  .hover-lift {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .hover-lift:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  }
`;

// Inject custom styles once
if (typeof document !== 'undefined' && !document.getElementById('chatbot-animations')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'chatbot-animations';
  styleSheet.textContent = getCustomStyles();
  document.head.appendChild(styleSheet);
}

// Types for the chat system
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatState {
  isOpen: boolean;
  isMinimized: boolean;
  messages: ChatMessage[];
  isConnected: boolean;
  isTyping: boolean;
  consecutiveNoDataResponses: number;
  isAnimating: boolean;
  animationType: 'enter' | 'exit' | 'minimize' | 'expand' | null;
  showWelcomeMessage: boolean;
  expandedMessages: Set<string>;
  typingMessages: Map<string, { content: string; currentIndex: number }>;
}

const AIChatbotWidget: React.FC = () => {
  const [chatState, setChatState] = useState<ChatState>({
    isOpen: false,
    isMinimized: false,
    messages: [],
    isConnected: false,
    isTyping: false,
    consecutiveNoDataResponses: 0,
    isAnimating: false,
    animationType: null,
    showWelcomeMessage: false,
    expandedMessages: new Set(),
    typingMessages: new Map()
  });

  const [inputValue, setInputValue] = useState('');
  const [sessionId, setSessionId] = useState<string>(Date.now().toString());
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Memoize chat state to prevent unnecessary re-renders
  const chatStateMemoized = useMemo(() => chatState, [chatState.messages.length, chatState.isOpen, chatState.isMinimized, chatState.isTyping]);

  // Typing animation functions
  const startTypingAnimation = useCallback((messageId: string, fullContent: string) => {
    // Clear any existing interval for this message
    const existingInterval = typingIntervalsRef.current.get(messageId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Initialize typing state for this message
    setChatState(prev => ({
      ...prev,
      typingMessages: new Map(prev.typingMessages).set(messageId, {
        content: '',
        currentIndex: 0
      })
    }));

    // Start typing animation
    let currentIndex = 0;
    const typingSpeed = 5; // milliseconds between characters

    const interval = setInterval(() => {
      if (currentIndex < fullContent.length) {
        setChatState(prev => {
          const newTypingMessages = new Map(prev.typingMessages);
          const currentTyping = newTypingMessages.get(messageId) || { content: '', currentIndex: 0 };
          const newContent = fullContent.substring(0, currentIndex + 1);
          
          newTypingMessages.set(messageId, {
            content: newContent,
            currentIndex: currentIndex + 1
          });
          
          return {
            ...prev,
            typingMessages: newTypingMessages
          };
        });
        
        currentIndex++;
      } else {
        // Animation complete, clear interval
        clearInterval(interval);
        typingIntervalsRef.current.delete(messageId);
        
        // Move from typing to regular messages
        setChatState(prev => {
          const newTypingMessages = new Map(prev.typingMessages);
          newTypingMessages.delete(messageId);
          
          return {
            ...prev,
            typingMessages: newTypingMessages
          };
        });
      }
    }, typingSpeed);

    typingIntervalsRef.current.set(messageId, interval);
  }, []);

  const stopTypingAnimation = useCallback((messageId: string) => {
    const interval = typingIntervalsRef.current.get(messageId);
    if (interval) {
      clearInterval(interval);
      typingIntervalsRef.current.delete(messageId);
    }
    
    setChatState(prev => {
      const newTypingMessages = new Map(prev.typingMessages);
      newTypingMessages.delete(messageId);
      return {
        ...prev,
        typingMessages: newTypingMessages
      };
    });
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'chat_response':
        const isNoDataResponse = data.response.includes('No matching CRM data available') ||
          data.response.includes('I can only answer using CRM data');

        const messageId = Date.now().toString();

        // Add message immediately but start typing animation
        setChatState(prev => ({
          ...prev,
          messages: [...prev.messages, {
            id: messageId,
            role: 'assistant',
            content: data.response,
            timestamp: new Date()
          }],
          isTyping: false,
          consecutiveNoDataResponses: isNoDataResponse ? prev.consecutiveNoDataResponses + 1 : 0
        }));

        // Start typing animation for the AI response
        startTypingAnimation(messageId, data.response);

        if (isNoDataResponse && chatState.consecutiveNoDataResponses >= 2) {
          setTimeout(() => {
            setChatState(prev => ({
              ...prev,
              messages: [...prev.messages, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'I notice you\'re asking questions that I can\'t answer with CRM data. I can help you with:\n\n• Project information and status\n• Employee details and assignments\n• Tender information and deadlines\n• General CRM data queries\n\nTry asking about specific CRM data, and I\'ll be happy to help!',
                timestamp: new Date()
              }]
            }));
            startTypingAnimation((Date.now() + 1).toString(), 'I notice you\'re asking questions that I can\'t answer with CRM data. I can help you with:\n\n• Project information and status\n• Employee details and assignments\n• Tender information and deadlines\n• General CRM data queries\n\nTry asking about specific CRM data, and I\'ll be happy to help!');
          }, 1000);
        }
        break;

      case 'error':
        setChatState(prev => ({
          ...prev,
          isTyping: false,
          messages: [...prev.messages, {
            id: Date.now().toString(),
            role: 'assistant',
            content: '❌ Failed to send message. Please try again.',
            timestamp: new Date()
          }]
        }));
        break;

      case 'connected':
        setChatState(prev => ({ ...prev, isConnected: true }));
        break;

      case 'disconnected':
        setChatState(prev => ({ ...prev, isConnected: false }));
        break;

      default:
        break;
    }
  }, [chatState.consecutiveNoDataResponses, startTypingAnimation]);

  const connectWebSocket = useCallback(() => {
    try {
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      console.log('Attempting to connect to WebSocket at ws://localhost:3001');
      const ws = new WebSocket('ws://localhost:3001');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connection established successfully');
        setChatState(prev => ({ ...prev, isConnected: true }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        setChatState(prev => ({ ...prev, isConnected: false }));
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setChatState(prev => ({ ...prev, isConnected: false }));
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setChatState(prev => ({ ...prev, isConnected: false }));
    }
  }, [handleWebSocketMessage]);

  // Initialize WebSocket connection only when chat is opened
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout | null = null;

    // Only connect if chat is open
    if (chatState.isOpen) {
      connectWebSocket();

      // Setup automatic reconnection logic
      const checkConnection = () => {
        if (!wsRef.current || (wsRef.current.readyState !== WebSocket.OPEN && wsRef.current.readyState !== WebSocket.CONNECTING)) {
          if (chatState.isOpen) {
            console.log('Connection lost, attempting automatic reconnect...');
            connectWebSocket();
          }
        }
      };

      reconnectTimeout = setInterval(checkConnection, 5000);
    } else {
      // Close connection when chat is closed
      if (wsRef.current) {
        wsRef.current.close(1000, 'Chat closed');
        wsRef.current = null;
      }
      setChatState(prev => ({ ...prev, isConnected: false }));
    }

    // Cleanup function
    return () => {
      if (reconnectTimeout) {
        clearInterval(reconnectTimeout);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }
    };
  }, [chatState.isOpen, connectWebSocket]); // Re-run if chat opens/closes or connection function changes


  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatState.messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (chatState.isOpen && !chatState.isMinimized) {
      inputRef.current?.focus();

      // Show welcome message with typing indicator when chat opens
      if (!chatState.showWelcomeMessage && chatState.messages.length === 0) {
        setChatState(prev => ({ ...prev, isTyping: true, showWelcomeMessage: true }));

        // Simulate typing delay then show greeting
        setTimeout(() => {
          setChatState(prev => ({
            ...prev,
            isTyping: false,
            messages: [{
              id: Date.now().toString(),
              role: 'assistant',
              content: 'Hello! I\'m your CRM AI assistant. How can I help you today?',
              timestamp: new Date()
            }]
          }));
        }, 2000); // 2 second typing delay
      }
    }
  }, [chatState.isOpen, chatState.isMinimized, chatState.showWelcomeMessage, chatState.messages.length]);

  // Toggle chat widget with smooth transitions
  const toggleChat = () => {
    if (chatState.isOpen) {
      // Closing the chat - immediate state change for smooth CSS transition
      setChatState(prev => ({
        ...prev,
        isOpen: false,
        isMinimized: false
      }));
    } else {
      // Opening the chat - immediate state change for smooth CSS transition
      setChatState(prev => ({
        ...prev,
        isOpen: true,
        isMinimized: false
      }));
    }
  };

  // Minimize chat
  const minimizeChat = () => {
    setChatState(prev => ({
      ...prev,
      isAnimating: true,
      animationType: 'minimize'
    }));

    setTimeout(() => {
      setChatState(prev => ({
        ...prev,
        isMinimized: true,
        isAnimating: false,
        animationType: null
      }));
    }, 300);
  };

  // Expand chat from minimized state
  const expandChat = () => {
    setChatState(prev => ({
      ...prev,
      isAnimating: true,
      animationType: 'expand',
      isMinimized: false
    }));

    setTimeout(() => {
      setChatState(prev => ({
        ...prev,
        isAnimating: false,
        animationType: null
      }));
    }, 300);
  };

  // Send message to backend
  const sendMessage = useCallback((message: string) => {
    if (!message.trim()) {
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected. Message not sent:', message);
      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, {
          id: Date.now().toString(),
          role: 'assistant',
          content: '⚠️ Connection lost. Please wait for the connection to be restored.',
          timestamp: new Date()
        }]
      }));
      return;
    }

    // Add user message to chat and reset no-data counter
    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, {
        id: Date.now().toString(),
        role: 'user',
        content: message,
        timestamp: new Date()
      }],
      isTyping: true,
      consecutiveNoDataResponses: 0
    }));

    // Send message to backend
    try {
      wsRef.current.send(JSON.stringify({
        type: 'chat',
        message: message,
        sessionId: sessionId
      }));
    } catch (error) {
      console.error('Error sending message:', error);
      setChatState(prev => ({
        ...prev,
        isTyping: false,
        messages: [...prev.messages, {
          id: Date.now().toString(),
          role: 'assistant',
          content: '❌ Failed to send message. Please try again.',
          timestamp: new Date()
        }]
      }));
    }
  }, [sessionId]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      sendMessage(inputValue);
      setInputValue('');
    }
  };

  // Format timestamp
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper functions for long answer options
  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const downloadAsText = (content: string, messageId: string) => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `chat-response-${messageId}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const shareContent = async (content: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Chat Response',
          text: content,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback to copying to clipboard
      copyToClipboard(content);
    }
  };

  const toggleMessageExpansion = (messageId: string) => {
    setChatState(prev => ({
      ...prev,
      expandedMessages: new Set(
        prev.expandedMessages.has(messageId)
          ? Array.from(prev.expandedMessages).filter(id => id !== messageId)
          : [...prev.expandedMessages, messageId]
      )
    }));
  };

  const isLongMessage = (content: string) => {
    return content.length > 300; // Consider messages over 300 characters as long
  };

  const truncateMessage = (content: string, isExpanded: boolean) => {
    if (!isLongMessage(content) || isExpanded) {
      return content;
    }
    return content.substring(0, 300) + '...';
  };

  // If chat is animating exit, show full chat with exit animation
  if (chatState.isAnimating && chatState.animationType === 'exit') {
    return (
      <div className="fixed bottom-4 right-4 z-50 w-96 h-[700px]">
        <Card className={cn(
          "h-full flex flex-col border-0 overflow-hidden rounded-2xl bg-white/90 backdrop-blur-xl",
          chatState.isAnimating && chatState.animationType === 'exit' && "animate-elegantOut"
        )}
        style={{
          boxShadow: '0 35px 60px -15px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 0 20px rgba(0, 0, 0, 0.1)',
          background: 'linear-gradient(to bottom, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.08) 15%, rgba(16, 185, 129, 0.05) 30%, rgba(255, 255, 255, 0.9) 60%, rgba(255, 255, 255, 0.95) 100%)',
          // Add inline animation for debugging
          transform: chatState.isAnimating && chatState.animationType === 'exit' ? 'scale(1.1) translateY(-10px)' : 'scale(1) translateY(0)',
          transition: chatState.isAnimating && chatState.animationType === 'exit' ? 'all 0.4s ease-in-out' : 'none',
          opacity: chatState.isAnimating && chatState.animationType === 'exit' ? '0.8' : '1'
        }}>
          {/* Header */}
          <div className="bg-gradient-to-b from-green-500 via-emerald-500 to-green-500/30 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              {/* Left side - Close button */}
              <div className="flex items-center space-x-3">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={toggleChat}
                  className="h-8 w-8 p-0 text-white hover:bg-white/20 rounded-lg transition-all duration-200"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Center - Chat info */}
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center shadow-lg">
                    <MessageCircle className="w-4 h-4 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-lg border-2 border-white animate-pulse shadow-sm"></div>
                </div>
                <div className="text-center">
                  <h3 className="text-white font-bold text-base">Text Support</h3>
                  <p className="text-green-100 text-xs font-medium">AI assistant</p>
                </div>
              </div>

              {/* Right side - Minimize button */}
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={minimizeChat}
                  className="h-8 w-8 p-0 text-white hover:bg-white/20 rounded-lg transition-all duration-200"
                  title="Minimize"
                >
                  <Minimize2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 bg-gradient-to-b from-green-50/60 via-white/70 to-emerald-50/80 overflow-hidden backdrop-blur-md">
            <ScrollArea className="h-full px-4 py-4">
              <div className="space-y-4">
                {chatState.messages.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-green-600 to-emerald-600 flex items-center justify-center">
                      <Bot className="w-8 h-8 text-white" />
                    </div>
                    <h4 className="text-gray-800 font-semibold text-lg mb-2">Welcome to your AI Assistant</h4>
                    <p className="text-gray-600 text-sm max-w-xs mx-auto">
                      Ask me about your CRM data, business insights, or any professional questions
                    </p>
                  </div>
                )}

                {chatState.messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex space-x-3",
                      message.role === 'user' ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-lg">
                        <img
                          src="/src/assets/artificial-intelligence.png"
                          alt="AI Assistant"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className={cn(
                      "max-w-[80%] rounded-2xl p-4 shadow-lg relative group transition-all duration-200 hover:shadow-xl",
                      message.role === 'user'
                        ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white ml-auto"
                        : "bg-white text-gray-900 border border-green-200"
                    )}>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {truncateMessage(message.content, chatState.expandedMessages.has(message.id))}
                      </p>

                      {/* Long message options */}
                      {isLongMessage(message.content) && (
                        <div className="mt-2 flex items-center justify-between">
                          <button
                            onClick={() => toggleMessageExpansion(message.id)}
                            className="flex items-center space-x-1 text-xs opacity-70 hover:opacity-100 transition-opacity"
                          >
                            {chatState.expandedMessages.has(message.id) ? (
                              <>
                                <ChevronUp className="w-3 h-3" />
                                <span>Show less</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3 h-3" />
                                <span>Show more</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Action buttons for assistant messages */}
                      {message.role === 'assistant' && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                          <button
                            onClick={() => copyToClipboard(message.content)}
                            className="p-1 rounded hover:bg-black/10 transition-colors"
                            title="Copy to clipboard"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => downloadAsText(message.content, message.id)}
                            className="p-1 rounded hover:bg-black/10 transition-colors"
                            title="Download as text"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => shareContent(message.content)}
                            className="p-1 rounded hover:bg-black/10 transition-colors"
                            title="Share"
                          >
                            <Share2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <p className={cn(
                        "text-xs mt-3 font-medium",
                        message.role === 'user' ? "text-white/80" : "text-gray-500"
                      )}>
                        {formatTime(message.timestamp)}
                      </p>
                    </div>

                    {message.role === 'user' && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden shadow-lg">
                      <img
                        src="/src/assets/user-removebg-preview.png"
                        alt="User"
                        className="w-full h-full object-cover"
                      />
                      </div>
                    )}
                  </div>
                ))}

                {/* Typing Indicator */}
                {chatState.isTyping && (
                  <div className="flex space-x-3 justify-start">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden">
                      <img
                        src="/src/assets/artificial-intelligence.png"
                        alt="AI Assistant"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-200">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </div>

          {/* Input Area */}
          <div className="bg-gradient-to-t from-green-50 to-emerald-50/30 p-4">
            <form onSubmit={handleSubmit}>
              {/* Main Input */}
              <div className="flex items-center space-x-3">
                {/* Input Field */}
                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Write a message..."
                    disabled={!chatState.isConnected || chatState.isTyping}
                    className="w-full rounded-full border-green-300 focus:border-green-500 focus:ring-green-500 px-4 py-3 pr-14 bg-white shadow-sm transition-all duration-200"
                  />
                  
                  {/* Send Button */}
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!inputValue.trim() || !chatState.isConnected || chatState.isTyping}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-md hover:shadow-lg transition-all duration-200"
                    title="Send message"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </form>

            {!chatState.isConnected && (
              <div className="mt-3 flex items-center justify-between text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Connection lost. Attempting to reconnect...</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    console.log('Manual reconnection triggered');
                    connectWebSocket();
                  }}
                  className="h-7 px-3 text-xs text-red-600 hover:bg-red-100 rounded-md transition-colors"
                >
                  Reconnect Now
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // If chat is closed and not animating exit, show only button
  if (!chatState.isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div
          onClick={toggleChat}
          className="w-32 h-32 cursor-pointer"
          style={{
            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            transform: 'scale(1) translateY(0)',
          }}
          onMouseEnter={(e) => {
            const target = e.currentTarget as HTMLElement;
            target.style.transform = 'scale(1.15) translateY(-4px)';
            target.style.filter = 'drop-shadow(0 12px 40px rgba(0, 0, 0, 0.35))';
          }}
          onMouseLeave={(e) => {
            const target = e.currentTarget as HTMLElement;
            target.style.transform = 'scale(1) translateY(0)';
            target.style.filter = 'none';
          }}
          aria-label="Open AI Chat"
        >
          <Lottie
            animationData={chatbotAnimation}
            className="w-full h-full"
            loop={true}
            autoplay={true}
          />
        </div>
      </div>
    );
  }

  // If chat is minimized, show small bar
  if (chatState.isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Card className={cn(
          "w-80 flex flex-col border-0 overflow-hidden rounded-2xl shadow-2xl shadow-black/20 bg-white/90 backdrop-blur-xl",
          chatState.isAnimating && chatState.animationType === 'minimize' && "animate-minimize",
          chatState.isAnimating && chatState.animationType === 'expand' && "animate-expand"
        )}
        style={{
          boxShadow: '0 35px 60px -15px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 0 20px rgba(0, 0, 0, 0.1)',
          background: 'linear-gradient(to bottom, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.08) 15%, rgba(16, 185, 129, 0.05) 30%, rgba(255, 255, 255, 0.9) 60%, rgba(255, 255, 255, 0.95) 100%)'
        }}>
          <div className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 rounded-full flex items-center justify-center overflow-hidden shadow-lg">
                <img
                  src="/src/assets/artificial-intelligence.png"
                  alt="AI Assistant"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="font-medium text-sm text-white">AI Assistant</span>
              <div className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                chatState.isConnected ? "bg-green-400 animate-pulse shadow-sm" : "bg-red-500 shadow-sm"
              )} />
            </div>
            <div className="flex items-center space-x-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={expandChat}
                className="h-8 w-8 p-0 text-white hover:bg-white/20 rounded-full transition-all duration-300 hover:scale-110"
              >
                <MessageCircle className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Full chat interface with slide-up animation
  return (
    <>
      {chatState.isOpen && (
        <div 
          className="fixed bottom-4 right-4 z-50 w-96 h-[700px]"
          style={{
            animation: 'slideUp 0.3s ease-out',
            transform: 'translateY(0) scale(1)',
            opacity: 1,
          }}
        >
          <Card className={cn(
            "h-full flex flex-col border-0 overflow-hidden rounded-2xl bg-white/90 backdrop-blur-xl"
          )}
          style={{
            boxShadow: '0 35px 60px -15px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 0 20px rgba(0, 0, 0, 0.1)',
            background: 'linear-gradient(to bottom, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.08) 15%, rgba(16, 185, 129, 0.05) 30%, rgba(255, 255, 255, 0.9) 60%, rgba(255, 255, 255, 0.95) 100%)'
          }}>
            {/* Header */}
            <div className="bg-gradient-to-b from-green-500/90 via-emerald-500/90 to-green-500/30 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                {/* Left side - Close button */}
                <div className="flex items-center space-x-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={toggleChat}
                    className="h-8 w-8 p-0 text-white hover:bg-white/30 rounded-lg transition-all duration-200 backdrop-blur-sm"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Center - Chat info */}
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-8 h-8 bg-white/30 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/30 shadow-lg">
                      <MessageCircle className="w-4 h-4 text-white" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-lg border-2 border-white animate-pulse shadow-sm"></div>
                  </div>
                  <div className="text-center">
                    <h3 className="text-white font-bold text-base">Text Support</h3>
                    <p className="text-green-100 text-xs font-medium">AI assistant</p>
                  </div>
                </div>

                {/* Right side - Minimize button */}
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={minimizeChat}
                    className="h-8 w-8 p-0 text-white hover:bg-white/30 rounded-lg transition-all duration-200 backdrop-blur-sm"
                    title="Minimize"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 bg-gradient-to-b from-green-50/60 via-white/70 to-emerald-50/80 overflow-hidden backdrop-blur-md">
              <ScrollArea className="h-full px-4 py-4">
                <div className="space-y-4">
                  {chatState.messages.length === 0 && !chatState.showWelcomeMessage && (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-green-600 to-emerald-600 flex items-center justify-center shadow-lg backdrop-blur-md border border-white/30">
                        <Bot className="w-10 h-10 text-white" />
                      </div>
                      <h4 className="text-gray-800 font-bold text-xl mb-3">Welcome to AI Assistant</h4>
                      <p className="text-gray-600 text-sm max-w-xs mx-auto leading-relaxed">
                        Ask me about your CRM data, business insights, or any professional questions
                      </p>
                    </div>
                  )}

                  {chatState.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex space-x-3",
                        message.role === 'user' ? "justify-end" : "justify-start"
                      )}
                    >
                      {message.role === 'assistant' && (
                        <div className="w-6 h-6 rounded-full overflow-hidden shadow-lg">
                          <img
                            src={robotIcon}
                            alt="AI Assistant"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <div className={cn(
                        "max-w-[80%] rounded-2xl p-4 shadow-lg relative group transition-all duration-500 hover:shadow-xl backdrop-blur-sm transform hover:scale-[1.03] origin-bottom",
                        message.role === 'user'
                          ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white ml-auto border border-white/30"
                          : "bg-white/95 text-gray-900 border border-green-400/60 backdrop-blur-sm"
                      )}>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed font-medium transition-all duration-300">
                          {message.role === 'assistant' && chatState.typingMessages.has(message.id)
                            ? chatState.typingMessages.get(message.id)?.content || ''
                            : truncateMessage(message.content, chatState.expandedMessages.has(message.id))
                          }
                          {message.role === 'assistant' && chatState.typingMessages.has(message.id) && (
                            <span className="inline-block w-2 h-4 bg-green-600 animate-pulse ml-1 rounded-sm transition-all duration-200"></span>
                          )}
                        </p>

                        {/* Long message options */}
                        {isLongMessage(message.content) && (
                          <div className="mt-2 flex items-center justify-between">
                            <button
                              onClick={() => toggleMessageExpansion(message.id)}
                              className="flex items-center space-x-1 text-xs opacity-70 hover:opacity-100 transition-opacity"
                            >
                              {chatState.expandedMessages.has(message.id) ? (
                                <>
                                  <ChevronUp className="w-3 h-3" />
                                  <span>Show less</span>
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3 h-3" />
                                  <span>Show more</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {/* Action buttons for assistant messages */}
                        {message.role === 'assistant' && (
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                            <button
                              onClick={() => copyToClipboard(message.content)}
                              className="p-1 rounded hover:bg-white/20 transition-colors"
                              title="Copy to clipboard"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => downloadAsText(message.content, message.id)}
                              className="p-1 rounded hover:bg-white/20 transition-colors"
                              title="Download as text"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => shareContent(message.content)}
                              className="p-1 rounded hover:bg-white/20 transition-colors"
                              title="Share"
                            >
                              <Share2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        <p className={cn(
                          "text-xs mt-3 font-medium",
                          message.role === 'user' ? "text-white/80" : "text-gray-500"
                        )}>
                          {formatTime(message.timestamp)}
                        </p>
                      </div>

                      {message.role === 'user' && (
                        <div className="w-6 h-6 rounded-full overflow-hidden shadow-lg">
                          <img
                            src={userIcon}
                            alt="User"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Typing Indicator */}
                  {chatState.isTyping && (
                    <div className="flex space-x-3 justify-start">
                      <div className="w-6 h-6 rounded-full overflow-hidden shadow-lg">
                        <img
                          src={robotIcon}
                          alt="AI Assistant"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-200">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                          <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </div>

            {/* Input Area */}
            <div className="bg-gradient-to-t from-green-50 to-emerald-50/30 p-4">
              <form onSubmit={handleSubmit}>
                {/* Main Input */}
                <div className="flex items-center space-x-3">
                  {/* Input Field */}
                  <div className="flex-1 relative">
                    <Input
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Write a message..."
                      disabled={!chatState.isConnected || chatState.isTyping}
                      className="w-full rounded-full border-green-300 focus:border-green-500 focus:ring-green-500 px-4 py-3 pr-14 bg-white shadow-sm transition-all duration-200"
                    />
                    
                    {/* Send Button */}
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!inputValue.trim() || !chatState.isConnected || chatState.isTyping}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-md hover:shadow-lg transition-all duration-200"
                      title="Send message"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </form>

              {!chatState.isConnected && (
                <div className="mt-3 flex items-center justify-between text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>Connection lost. Attempting to reconnect...</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      console.log('Manual reconnection triggered');
                      connectWebSocket();
                    }}
                    className="h-7 px-3 text-xs text-red-600 hover:bg-red-100 rounded-md transition-colors"
                  >
                    Reconnect Now
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* CSS for slideUp animation */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `
      }} />
    </>
  );
};

export default AIChatbotWidget;
