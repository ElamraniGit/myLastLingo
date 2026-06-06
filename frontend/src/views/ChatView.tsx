/**
 * AI Chat — conversational English learning assistant.
 *
 * UI improvements:
 *  - Markdown-like rendering (bold, code, bullet lists)
 *  - Categorised suggestions with icons
 *  - Typing indicator with staggered dots
 *  - Message timestamps
 *  - Copy message button
 *  - Character counter in input
 *  - Smooth scroll on new message
 *  - Better empty state with feature cards
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { chatApi, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { awardXP } from '@/components/common/XPBar';
import { Input } from '@/components/ui/Input';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts?: number;
}

// Categorised suggestions
const SUGGESTION_GROUPS = [
  {
    label: 'My Vocabulary',
    icon: (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><rect x='3' y='3' width='5' height='18' rx='1'/><rect x='10' y='3' width='5' height='18' rx='1'/><path d='M17 3l4 2v14l-4 2V3z'/></svg>),
    items: [
      "What are my weakest words?",
      "Quiz me on 5 random words",
      "Create a story using my saved words",
    ],
  },
  {
    label: 'Today',
    icon: (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><rect x='3' y='4' width='18' height='18' rx='2'/><line x1='16' y1='2' x2='16' y2='6'/><line x1='8' y1='2' x2='8' y2='6'/><line x1='3' y1='10' x2='21' y2='10'/></svg>),
    items: [
      "Which words should I review today?",
      "How many words have I learned this week?",
    ],
  },
  {
    label: 'Grammar & Usage',
    icon: (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/><path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z'/></svg>),
    items: [
      "Explain the difference between my similar words",
      "Give me example sentences for my newest words",
      "What collocations go with my verb words?",
    ],
  },
];

/* ── Simple Markdown renderer (no deps) ──────────────────────── */
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Bullet list
    if (/^[\-\*•]\s+/.test(line)) {
      elements.push(
        <div key={key++} className="flex items-start gap-2 my-0.5">
          <span className="text-blue-400 shrink-0 mt-0.5">•</span>
          <span>{inlineMarkdown(line.replace(/^[\-\*•]\s+/, ''))}</span>
        </div>
      );
      continue;
    }
    // Numbered list
    if (/^\d+\.\s+/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      elements.push(
        <div key={key++} className="flex items-start gap-2 my-0.5">
          <span className="text-blue-400 shrink-0 font-mono text-xs mt-0.5">{num}.</span>
          <span>{inlineMarkdown(line.replace(/^\d+\.\s+/, ''))}</span>
        </div>
      );
      continue;
    }
    // Empty line
    if (!line.trim()) {
      elements.push(<div key={key++} className="h-2" />);
      continue;
    }
    // Normal line
    elements.push(<div key={key++}>{inlineMarkdown(line)}</div>);
  }

  return <>{elements}</>;
}

function inlineMarkdown(text: string): React.ReactNode {
  // Split on **bold** and `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (/^\*\*(.+)\*\*$/.test(part)) {
          return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
        }
        if (/^`(.+)`$/.test(part)) {
          return (
            <code key={i} className="bg-white/10 px-1 py-0.5 rounded text-xs font-mono text-blue-200">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function fmtTime(ts?: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ════════════════════════════════════════════════════════════════ */

export default function ChatView() {
  const [messages,   setMessages]   = useState<Message[]>([]);
  const [input,      setInput]      = useState('');
  const [sending,    setSending]    = useState(false);
  const [convId,     setConvId]     = useState<string | null>(null);
  const [hasKey,     setHasKey]     = useState<boolean | null>(null);
  const [keyInput,   setKeyInput]   = useState('');
  const [settingKey, setSettingKey] = useState(false);
  const [copied,     setCopied]     = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatApi.hasKey().then(d => setHasKey(d.has_key)).catch(() => setHasKey(false));
  }, []);

  useEffect(() => {
    if (!hasKey) return;
    chatApi.getHistory()
      .then(d => {
        if (d.messages?.length) {
          const sorted = [...d.messages].reverse();
          setMessages(sorted.map((m: any) => ({ role: m.role, content: m.content })));
          if (sorted[0]?.conversation_id) setConvId(sorted[0].conversation_id);
        }
      })
      .catch(() => {});
  }, [hasKey]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, sending]);

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || sending) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg, ts: Date.now() }]);
    setSending(true);
    try {
      const res = await chatApi.sendMessage(msg, convId || undefined);
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply, ts: Date.now() }]);
      awardXP('chat_message');
      if (res.conversation_id) setConvId(res.conversation_id);
    } catch (e) {
      const errMsg = e instanceof ApiError ? e.message : 'Failed to send message';
      setMessages(prev => [...prev, { role: 'assistant', content: `${errMsg}`, ts: Date.now() }]);
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
    } catch {}
    setSettingKey(false);
  };

  const clearChat = async () => {
    if (!confirm('Clear all chat history?')) return;
    try {
      await chatApi.clearHistory();
      setMessages([]);
      setConvId(null);
    } catch {}
  };

  const copyMessage = (content: string, idx: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {});
  };

  /* ── API key setup ──────────────────────────────────────────── */
  if (hasKey === false) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 space-y-5 animate-fade-in">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto mb-4
                          flex items-center justify-center shadow-xl shadow-blue-500/20">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-heading tracking-tight">AI Learning Assistant</h1>
          <p className="text-muted text-sm mt-2 leading-relaxed">
            Your personal English tutor — knows your vocabulary, answers questions, creates quizzes.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: (<svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='6'/><circle cx='12' cy='12' r='2' fill='currentColor' stroke='none'/></svg>), label: 'Personalised', sub: 'Uses your words' },
            { icon: (<svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><path d='M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24A2.5 2.5 0 0 1 9.5 2z'/><path d='M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24A2.5 2.5 0 0 0 14.5 2z'/></svg>), label: 'Smart Quizzes', sub: 'Test your memory' },
            { icon: (<svg className='w-5 h-5' viewBox='0 0 24 24' fill='currentColor'><polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'/></svg>), label: 'Instant', sub: 'Powered by Groq' },
          ].map(f => (
            <div key={f.label} className="bg-card border border-default rounded-2xl p-3 text-center">
              <div className="text-xl mb-1">{f.icon}</div>
              <div className="text-xs font-semibold text-heading">{f.label}</div>
              <div className="text-sm text-muted">{f.sub}</div>
            </div>
          ))}
        </div>

        <div className="bg-card border border-default rounded-2xl p-5 space-y-4">
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
        <p className="text-center text-xs text-faint">Free tier: 30 req/min · Key stored on your device only</p>
      </div>
    );
  }

  /* ── Loading ────────────────────────────────────────────────── */
  if (hasKey === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-default border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  /* ── Chat UI ────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 nav-bar border-b border-default shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl
                          flex items-center justify-center shadow-sm shadow-blue-500/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-heading">AI Assistant</h2>
            <p className="text-xs text-muted flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-soft"/>
              Knows your vocabulary
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-muted hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">

        {/* Empty state */}
        {messages.length === 0 && !sending && (
          <div className="space-y-5 animate-fade-in">
            <p className="text-center text-muted text-sm pt-2">
              Ask me anything about your English learning!
            </p>
            {SUGGESTION_GROUPS.map(group => (
              <div key={group.label}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-base">{group.icon}</span>
                  <span className="text-xs font-semibold text-muted uppercase tracking-wider">{group.label}</span>
                </div>
                <div className="space-y-1.5">
                  {group.items.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => send(s)}
                      className="w-full text-left text-xs text-body bg-card border border-default
                                 rounded-xl px-3.5 py-2.5 hover:border-blue-500/30 hover:bg-blue-500/5
                                 transition-colors leading-relaxed"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
            <div className={`max-w-[88%] ${msg.role === 'user' ? '' : 'flex flex-col'}`}>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-card border border-default text-body rounded-bl-md'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="text-base leading-relaxed">
                    {renderMarkdown(msg.content)}
                  </div>
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>
              {/* Timestamp + copy */}
              <div className={`flex items-center gap-2 mt-1 px-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.ts && (
                  <span className="text-sm text-faint">{fmtTime(msg.ts)}</span>
                )}
                <button
                  onClick={() => copyMessage(msg.content, i)}
                  className="text-xs text-faint hover:text-muted opacity-0 group-hover:opacity-100 transition-all"
                  aria-label="Copy"
                >
                  {copied === i ? (<svg className='w-3.5 h-3.5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><polyline points='20 6 9 17 4 12'/></svg>) : (<svg className='w-3.5 h-3.5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><path d='M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'/><rect x='8' y='2' width='8' height='4' rx='1'/></svg>)}
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-card border border-default rounded-2xl rounded-bl-md px-4 py-3.5">
              <div className="flex gap-1.5 items-center">
                {[0, 150, 300].map(d => (
                  <span
                    key={d}
                    className="w-2 h-2 bg-muted rounded-full animate-bounce"
                    style={{ animationDelay: `${d}ms`, animationDuration: '900ms' }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-default px-3 py-3 nav-bar">
        <div className="flex gap-2 max-w-2xl mx-auto items-end">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about your words…"
              disabled={sending}
              maxLength={500}
              className="w-full bg-card border border-default rounded-2xl px-4 py-3 pr-12
                         text-sm text-heading placeholder-muted focus:outline-none
                         focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/15
                         disabled:opacity-50 transition-all"
            />
            {/* Character count */}
            {input.length > 400 && (
              <span className="absolute right-3 bottom-3 text-xs text-faint">
                {500 - input.length}
              </span>
            )}
          </div>
          <button
            onClick={() => send()}
            disabled={sending || !input.trim()}
            className="w-11 h-11 flex items-center justify-center bg-blue-600 hover:bg-blue-500
                       text-white rounded-2xl disabled:opacity-40 transition-all active:scale-95
                       shadow-sm shadow-blue-500/20 shrink-0"
            aria-label="Send"
          >
            {sending ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
