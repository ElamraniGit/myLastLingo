/**
 * AI Chat — conversational English learning assistant.
 * Has full access to user's vocabulary data.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { chatApi, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  "What are my weakest words?",
  "Create a short story using my words",
  "Quiz me on 5 random words",
  "Which words should I review today?",
  "Explain the difference between my similar words",
  "Give me example sentences for my newest words",
];

export default function ChatView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [settingKey, setSettingKey] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if API key exists
  useEffect(() => {
    chatApi.hasKey()
      .then(d => setHasKey(d.has_key))
      .catch(() => setHasKey(false));
  }, []);

  // Load history
  useEffect(() => {
    if (hasKey) {
      chatApi.getHistory()
        .then(d => {
          if (d.messages?.length) {
            const sorted = [...d.messages].reverse();
            setMessages(sorted.map((m: any) => ({ role: m.role, content: m.content })));
            if (sorted[0]?.conversation_id) setConvId(sorted[0].conversation_id);
          }
        })
        .catch(() => {});
    }
  }, [hasKey]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || sending) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setSending(true);

    try {
      const res = await chatApi.sendMessage(msg, convId || undefined);
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);
      if (res.conversation_id) setConvId(res.conversation_id);
    } catch (e) {
      const errMsg = e instanceof ApiError ? e.message : 'Failed to send message';
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${errMsg}` }]);
    }

    setSending(false);
    inputRef.current?.focus();
  }, [input, sending, convId]);

  const saveKey = async () => {
    if (!keyInput.trim()) return;
    setSettingKey(true);
    try {
      await chatApi.setKey(keyInput.trim());
      setHasKey(true);
      setKeyInput('');
    } catch { }
    setSettingKey(false);
  };

  const clearChat = async () => {
    try {
      await chatApi.clearHistory();
      setMessages([]);
      setConvId(null);
    } catch { }
  };

  // API key setup screen
  if (hasKey === false) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 space-y-5">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-heading">AI Learning Assistant</h1>
          <p className="text-muted text-sm mt-2">
            Chat with AI that knows your vocabulary and helps you learn.
          </p>
        </div>

        <div className="bg-card border border-line rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-heading mb-1">Setup (one time)</h3>
            <p className="text-xs text-muted leading-relaxed">
              Get a free API key from{' '}
              <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer"
                className="text-blue-400 underline">console.groq.com/keys</a>
              {' '}and paste it below.
            </p>
          </div>

          <Input
            label="Groq API Key"
            type="password"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveKey(); }}
            placeholder="gsk_..."
          />

          <Button onClick={saveKey} loading={settingKey} variant="primary" className="w-full">
            Save & Start Chatting
          </Button>
        </div>

        <div className="text-center">
          <p className="text-[11px] text-faint">Free tier: 30 requests/minute • Your key stays on your device</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (hasKey === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-line border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Chat UI
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line-s flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-heading">AI Assistant</h2>
            <p className="text-[10px] text-muted">Knows your vocabulary</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="text-xs text-muted hover:text-body px-2 py-1 rounded-lg hover:bg-card">
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-5">
            <p className="text-muted text-sm">Ask me anything about your vocabulary!</p>
            <div className="grid grid-cols-1 gap-2 max-w-sm mx-auto">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s)}
                  className="text-left text-xs text-body bg-card border border-line-s rounded-xl px-3 py-2.5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-colors">
                  💬 {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-md'
                : 'bg-card border border-line-s text-body rounded-bl-md'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-card border border-line-s rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-line-s px-3 py-3">
        <div className="flex gap-2 max-w-2xl mx-auto">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask about your words..."
            disabled={sending}
            className="flex-1 bg-input-bg border border-line rounded-xl px-4 py-2.5 text-sm text-heading placeholder-muted focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
          />
          <button onClick={() => send()} disabled={sending || !input.trim()}
            className="w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white rounded-xl disabled:opacity-40 transition-colors flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
