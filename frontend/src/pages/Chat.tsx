import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {

  Sparkles,
  Send,
  User,
  Loader2,
  ChevronDown,
  ChevronUp,
  Brain,

  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import clsx from 'clsx';
import { sendMessage, type ChatResponse } from '../api/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: ChatResponse;
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I'm Nexus AI, your intelligent assistant. I can help you analyze data, generate insights, check compliance, and much more. What would you like to explore today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [expandedExplanation, setExpandedExplanation] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: data.taskId,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        metadata: data
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
    onError: (error) => {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `I encountered an error: ${error.message}. Please try again.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || mutation.isPending) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    mutation.mutate(input);
    setInput('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const exampleQueries = [
    "Analyze our financial transactions from the past month",
    "What are the current compliance risks?",
    "Show me user engagement trends",
    "Generate a financial summary report",
    "Check system health status"
  ];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-white">AI Assistant</h1>
        <p className="text-white/50 mt-1">Natural language interface to the Nexus AI platform</p>
      </div>

      {/* Chat Container */}
      <div className="flex-1 glass-card flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={clsx(
                  'flex gap-4',
                  message.role === 'user' ? 'flex-row-reverse' : ''
                )}
              >
                {/* Avatar */}
                <div className={clsx(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                  message.role === 'user'
                    ? 'bg-accent-purple/20 border border-accent-purple/30'
                    : 'bg-nexus-500/20 border border-nexus-500/30'
                )}>
                  {message.role === 'user' ? (
                    <User className="w-5 h-5 text-accent-purple" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-nexus-400" />
                  )}
                </div>

                {/* Content */}
                <div className={clsx(
                  'flex-1 max-w-[75%]',
                  message.role === 'user' ? 'text-right' : ''
                )}>
                  <div className={clsx(
                    'inline-block text-left',
                    message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'
                  )}>
                    <p className="text-white whitespace-pre-wrap">{message.content}</p>
                  </div>

                  {/* Metadata (for assistant messages) */}
                  {message.metadata && (
                    <div className="mt-3 space-y-2">
                      {/* Status & Confidence */}
                      <div className="flex items-center gap-3 text-sm">
                        {message.metadata.status === 'completed' ? (
                          <span className="badge-success flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Completed
                          </span>
                        ) : (
                          <span className="badge-warning flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {message.metadata.status}
                          </span>
                        )}
                        <span className="text-white/40">
                          {Math.round(message.metadata.explanation.confidence * 100)}% confidence
                        </span>
                        <span className="text-white/40 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {message.metadata.metadata.duration}ms
                        </span>
                      </div>

                      {/* Agents Used */}
                      {message.metadata.metadata.agentsUsed.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Brain className="w-4 h-4 text-white/40" />
                          {message.metadata.metadata.agentsUsed.map((agent) => (
                            <span
                              key={agent}
                              className="px-2 py-0.5 bg-surface-elevated rounded text-xs text-white/60"
                            >
                              {agent}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Explanation Toggle */}
                      <button
                        onClick={() => setExpandedExplanation(
                          expandedExplanation === message.id ? null : message.id
                        )}
                        className="flex items-center gap-1 text-xs text-nexus-400 hover:text-nexus-300 transition-colors"
                      >
                        {expandedExplanation === message.id ? (
                          <>
                            <ChevronUp className="w-3 h-3" />
                            Hide explanation
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" />
                            Show explanation
                          </>
                        )}
                      </button>

                      {/* Expanded Explanation */}
                      <AnimatePresence>
                        {expandedExplanation === message.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-surface-tertiary/50 rounded-xl p-4 border border-white/5"
                          >
                            <h4 className="text-sm font-medium text-white mb-2">AI Reasoning</h4>
                            <p className="text-sm text-white/60 mb-3">
                              {message.metadata.explanation.reasoning}
                            </p>

                            {message.metadata.explanation.dataSources.length > 0 && (
                              <div className="mb-3">
                                <h5 className="text-xs text-white/40 uppercase tracking-wider mb-1">Data Sources</h5>
                                <div className="flex flex-wrap gap-1">
                                  {message.metadata.explanation.dataSources.map((source, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-surface-elevated rounded text-xs text-white/60">
                                      {source}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {message.metadata.explanation.limitations.length > 0 && (
                              <div>
                                <h5 className="text-xs text-white/40 uppercase tracking-wider mb-1">Limitations</h5>
                                <ul className="text-xs text-white/50 list-disc list-inside">
                                  {message.metadata.explanation.limitations.map((lim, i) => (
                                    <li key={i}>{lim}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  <p className="text-xs text-white/30 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading indicator */}
          {mutation.isPending && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-nexus-500/20 border border-nexus-500/30 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-nexus-400 animate-spin" />
              </div>
              <div className="chat-bubble-assistant">
                <div className="flex items-center gap-2">
                  <span className="text-white/60">Processing your request</span>
                  <span className="flex gap-1">
                    <span className="w-2 h-2 bg-nexus-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-nexus-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-nexus-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Example Queries */}
        {messages.length <= 1 && (
          <div className="px-6 pb-4">
            <p className="text-xs text-white/40 mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {exampleQueries.map((query) => (
                <button
                  key={query}
                  onClick={() => setInput(query)}
                  className="px-3 py-1.5 bg-surface-tertiary/50 hover:bg-surface-tertiary border border-white/5 hover:border-white/10 rounded-lg text-sm text-white/60 hover:text-white transition-all"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-white/5">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Nexus AI anything..."
              className="input-field flex-1"
              disabled={mutation.isPending}
            />
            <button
              type="submit"
              disabled={!input.trim() || mutation.isPending}
              className={clsx(
                'btn-primary flex items-center gap-2',
                (!input.trim() || mutation.isPending) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {mutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}






