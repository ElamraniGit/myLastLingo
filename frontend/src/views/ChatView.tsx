/**
 * ChatView — AI Learning Assistant
 *
 * Features:
 *  · Streaming responses (SSE) — tokens appear as they're generated
 *  · Smart suggestions grouped by intent
 *  · Full markdown rendering (headings, bold, italic, code, lists, tables)
 *  · Copy message, regenerate last response
 *  · Conversation history loaded from server
 *  · Clean setup flow when no API key configured
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { chatApi, ApiError } from '@/lib/api';
import { awardXP } from '@/components/common/XPBar';
import { useStore } from '@/store/appStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id:      string;
  role:    'user' | 'assistant';
  content: string;
  ts:      number;
  error?:  boolean;
}

// ── Suggestion groups ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  {
    label: 'My Words',
    color: 'text-blue-500',
    bg:    'bg-blue-500/8 border-blue-500/20 hover:bg-blue-500/14',
    icon:  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="18" rx="1"/><path d="M17 3l4 2v14l-4 2V3z"/></svg>,
    items: [
      "Quiz me on my 5 weakest words",
      "What words should I focus on today?",
      "Show me my hardest words with example sentences",
      "Make a fill-in-the-blank exercise with my words",
    ],
  },
  {
    label: 'Practice',
    color: 'text-green-500',
    bg:    'bg-green-500/8 border-green-500/20 hover:bg-green-500/14',
    icon:  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635l-4 1 1-4z"/></svg>,
    items: [
      "Write a short story using 5 of my saved words",
      "Correct my sentence and explain the grammar",
      "Give me a dialogue using my vocabulary",
      "Create 3 sentences I should memorise today",
    ],
  },
  {
    label: 'Explain',
    color: 'text-purple-500',
    bg:    'bg-purple-500/8 border-purple-500/20 hover:bg-purple-500/14',
    icon:  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5"/></svg>,
    items: [
      "What's the difference between my similar words?",
      "Explain the most common collocations for my verbs",
      "Which of my words are formal vs informal?",
      "Analyse my progress and give me honest feedback",
    ],
  },
];

// ── Markdown renderer ─────────────────────────────────────────────────────────

function Markdown({ text }: { text: string }) {
  const nodes = useMemo(() => parseMarkdown(text), [text]);
  return <div className="space-y-1.5">{nodes}</div>;
}

function parseMarkdown(text: string): React.ReactNode[] {
  const lines  = text.split('\n');
  const result: React.ReactNode[] = [];
  let   key    = 0;
  let   i      = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Heading
    const hm = line.match(/^(#{1,3})\s+(.+)/);
    if (hm) {
      const level = hm[1].length;
      const cls   = level === 1 ? 'text-base font-bold text-heading mt-2' :
                    level === 2 ? 'text-sm font-bold text-heading mt-1.5' :
                                  'text-sm font-semibold text-body mt-1';
      result.push(<p key={key++} className={cls}>{inline(hm[2])}</p>);
      i++; continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      result.push(<hr key={key++} className="border-subtle my-2" />);
      i++; continue;
    }

    // Fenced code block
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]); i++;
      }
      i++;
      result.push(
        <pre key={key++} className="bg-elevated rounded-lg px-3 py-2.5 text-xs font-mono text-heading overflow-x-auto">
          {codeLines.join('\n')}
        </pre>
      );
      continue;
    }

    // Bullet list
    if (/^[\-\*•]\s+/.test(line)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^[\-\*•]\s+/.test(lines[i])) {
        listItems.push(
          <li key={i} className="flex items-start gap-2">
            <span className="text-accent shrink-0 mt-[3px] leading-none">•</span>
            <span className="flex-1">{inline(lines[i].replace(/^[\-\*•]\s+/, ''))}</span>
          </li>
        );
        i++;
      }
      result.push(<ul key={key++} className="space-y-1">{listItems}</ul>);
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(line)) {
      const listItems: React.ReactNode[] = [];
      let n = 1;
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        listItems.push(
          <li key={i} className="flex items-start gap-2">
            <span className="text-accent font-mono text-xs shrink-0 mt-[3px] w-4">{n}.</span>
            <span className="flex-1">{inline(lines[i].replace(/^\d+\.\s+/, ''))}</span>
          </li>
        );
        i++; n++;
      }
      result.push(<ol key={key++} className="space-y-1">{listItems}</ol>);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      result.push(
        <blockquote key={key++} className="border-l-2 border-blue-500/40 pl-3 text-body italic">
          {inline(line.slice(2))}
        </blockquote>
      );
      i++; continue;
    }

    // Empty line
    if (!line.trim()) {
      result.push(<div key={key++} className="h-1.5" />);
      i++; continue;
    }

    // Paragraph
    result.push(<p key={key++} className="leading-relaxed">{inline(line)}</p>);
    i++;
  }

  return result;
}

function inline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[.+?\]\(.+?\))/g);
  return (
    <>
      {parts.map((p, i) => {
        if (/^\*\*(.+)\*\*$/.test(p))
          return <strong key={i} className="font-semibold text-heading">{p.slice(2, -2)}</strong>;
        if (/^\*(.+)\*$/.test(p))
          return <em key={i} className="italic text-body">{p.slice(1, -1)}</em>;
        if (/^`(.+)`$/.test(p))
          return <code key={i} className="bg-elevated px-1.5 py-0.5 rounded text-xs font-mono text-heading">{p.slice(1, -1)}</code>;
        const lm = p.match(/^\[(.+?)\]\((.+?)\)$/);
        if (lm)
          return <a key={i} href={lm[2]} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">{lm[1]}</a>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2); }
function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ══════════════════════════════════════════════════════════════════════════════
// ChatView
// ══════════════════════════════════════════════════════════════════════════════

export default function ChatView() {
  const { setPage } = useStore();

  const [messages,   setMessages]   = useState<Message[]>([]);
  const [input,      setInput]      = useState('');
  const [streaming,  setStreaming]  = useState(false);
  const [convId,     setConvId]     = useState<string | undefined>();
  const [hasKey,     setHasKey]     = useState<boolean | null>(null);
  const [keyInput,   setKeyInput]   = useState('');
  const [savingKey,  setSavingKey]  = useState(false);
  const [keyError,   setKeyError]   = useState('');
  const [copied,     setCopied]     = useState<string | null>(null);

  const scrollRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const abortRef   = useRef<AbortController | null>(null);

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    chatApi.hasKey().then(d => setHasKey(d.has_key)).catch(() => setHasKey(false));
  }, []);

  useEffect(() => {
    if (!hasKey) return;
    chatApi.getHistory()
      .then(d => {
        if (!d.messages?.length) return;
        const msgs: Message[] = d.messages.map((m: any) => ({
          id: uid(), role: m.role, content: m.content,
          ts: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
        }));
        setMessages(msgs);
        if (d.messages[0]?.conversation_id) setConvId(d.messages[0].conversation_id);
      })
      .catch(() => {});
  }, [hasKey]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
  }, [messages, streaming]);

  // ── Send ────────────────────────────────────────────────────────────────────
  const send = useCallback((text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;
    setInput('');

    const userMsg: Message = { id: uid(), role: 'user', content: msg, ts: Date.now() };
    const assistantId      = uid();
    const placeholder: Message = { id: assistantId, role: 'assistant', content: '', ts: Date.now() };

    setMessages(prev => [...prev, userMsg, placeholder]);
    setStreaming(true);

    let fullContent = '';

    abortRef.current = chatApi.sendMessageStream(
      msg,
      convId,
      // onToken
      (token) => {
        fullContent += token;
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: fullContent } : m
        ));
      },
      // onDone
      (meta) => {
        if (meta.conversation_id) setConvId(meta.conversation_id);
        setStreaming(false);
        awardXP('chat_message');
        inputRef.current?.focus();
      },
      // onError
      (errMsg) => {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: errMsg || 'Something went wrong. Try again.', error: true }
            : m
        ));
        setStreaming(false);
        inputRef.current?.focus();
      },
    );
  }, [input, streaming, convId]);

  const stopStreaming = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  // ── Key actions ─────────────────────────────────────────────────────────────
  const saveKey = async () => {
    const k = keyInput.trim();
    if (!k) return;
    if (!k.startsWith('gsk_')) { setKeyError('Key must start with gsk_'); return; }
    setSavingKey(true); setKeyError('');
    try {
      await chatApi.setKey(k);
      setHasKey(true); setKeyInput('');
    } catch (e: any) {
      setKeyError(e?.message || 'Failed to save key');
    }
    setSavingKey(false);
  };

  const clearChat = async () => {
    if (!window.confirm('Clear all conversation history?')) return;
    try { await chatApi.clearHistory(); } catch { /* noop */ }
    setMessages([]); setConvId(undefined);
  };

  const copyMsg = (content: string, id: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(id); setTimeout(() => setCopied(null), 2000);
    }).catch(() => {});
  };

  // ── Key textarea height ──────────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ── Setup screen ────────────────────────────────────────────────────────────
  if (hasKey === false) return (
    <div className="max-w-sm mx-auto px-4 py-10 animate-fade-in">

      {/* Hero */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600
                        flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
          <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <h1 className="text-xl font-bold text-heading tracking-tight">AI Tutor</h1>
        <p className="text-sm text-muted mt-1.5 leading-relaxed">
          Your personal English tutor — knows your vocabulary, quizzes you, and explains grammar.
        </p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {[
          { icon: '🎯', label: 'Personalised', sub: 'Uses your words' },
          { icon: '⚡', label: 'Instant',      sub: 'Groq-powered'   },
          { icon: '🆓', label: 'Free',         sub: '30 req/min'     },
        ].map(f => (
          <div key={f.label} className="bg-card border border-default rounded-xl p-3 text-center">
            <p className="text-lg mb-1">{f.icon}</p>
            <p className="text-xs font-semibold text-heading">{f.label}</p>
            <p className="text-xs text-muted">{f.sub}</p>
          </div>
        ))}
      </div>

      {/* Key form */}
      <div className="bg-card border border-default rounded-2xl p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-heading mb-1">Connect your free Groq key</p>
          <p className="text-xs text-muted leading-relaxed">
            1. Go to{' '}
            <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer"
               className="text-accent underline">console.groq.com/keys</a>
            {' '}→ Create API key (free)
            <br />2. Paste it below
          </p>
        </div>

        <div>
          <input
            type="password"
            value={keyInput}
            onChange={e => { setKeyInput(e.target.value); setKeyError(''); }}
            onKeyDown={e => e.key === 'Enter' && saveKey()}
            placeholder="gsk_..."
            className="input-field text-sm"
          />
          {keyError && <p className="text-xs text-red-400 mt-1.5">{keyError}</p>}
        </div>

        <button
          onClick={saveKey}
          disabled={savingKey || !keyInput.trim()}
          className="btn-primary w-full py-2.5 text-sm"
        >
          {savingKey ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving…
            </span>
          ) : 'Start Chatting'}
        </button>
      </div>

      <p className="text-center text-xs text-faint mt-4">
        Key stored on your device only · Never shared
      </p>
    </div>
  );

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (hasKey === null) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-7 h-7 border-2 border-default border-t-accent rounded-full animate-spin" />
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ── Main chat UI ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-base">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-base/90
                      backdrop-blur border-b border-subtle shrink-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600
                          flex items-center justify-center shadow-sm">
            <svg className="w-[15px] h-[15px] text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-heading leading-none">AI Tutor</p>
            <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-soft inline-block" />
              Knows your vocabulary
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-xs text-muted hover:text-red-400 px-2 py-1.5 rounded-lg
                         hover:bg-red-500/8 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 scrollbar-none">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="space-y-5 animate-fade-in">
            <p className="text-center text-sm text-muted pt-1">
              Ask me anything about your English learning
            </p>

            {SUGGESTIONS.map(group => (
              <div key={group.label}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={group.color}>{group.icon}</span>
                  <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                    {group.label}
                  </span>
                </div>
                <div className="grid gap-1.5">
                  {group.items.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => send(s)}
                      className={`w-full text-left text-sm text-heading border rounded-xl
                                  px-3.5 py-2.5 transition-all ${group.bg}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Message list */}
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* Avatar for assistant */}
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600
                                flex items-center justify-center shrink-0 mr-2 mt-0.5 shadow-sm">
                  <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
              )}

              <div className={`max-w-[85%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {/* Bubble */}
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-accent text-white rounded-tr-sm'
                    : msg.error
                      ? 'bg-red-500/10 border border-red-500/25 text-red-400 rounded-tl-sm'
                      : 'bg-card border border-default text-heading rounded-tl-sm'
                }`}>
                  {msg.role === 'user' ? (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  ) : msg.content ? (
                    <Markdown text={msg.content} />
                  ) : (
                    /* Streaming cursor */
                    <span className="inline-block w-0.5 h-4 bg-muted animate-pulse-soft align-middle" />
                  )}
                </div>

                {/* Meta row */}
                <div className={`flex items-center gap-2 mt-1 px-1 ${
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}>
                  <span className="text-xs text-faint">{fmtTime(msg.ts)}</span>

                  {/* Copy button */}
                  {msg.content && (
                    <button
                      onClick={() => copyMsg(msg.content, msg.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-faint hover:text-muted"
                      title="Copy"
                    >
                      {copied === msg.id ? (
                        <svg className="w-3 h-3 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing dots (while waiting for first token) */}
          {streaming && messages.at(-1)?.content === '' && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600
                              flex items-center justify-center shrink-0 mr-2 mt-0.5">
                <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div className="bg-card border border-default rounded-2xl rounded-tl-sm px-4 py-3.5">
                <div className="flex gap-1.5 items-center">
                  {[0, 140, 280].map(d => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce"
                          style={{ animationDelay: `${d}ms`, animationDuration: '900ms' }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-subtle bg-base/90 backdrop-blur px-3 py-3">
        <div className="flex gap-2 max-w-2xl mx-auto items-end">

          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Type your question…"
            disabled={streaming}
            maxLength={600}
            className="flex-1 resize-none bg-card border-2 border-default rounded-2xl
                       px-4 py-3 text-base text-heading placeholder:text-muted
                       focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10
                       disabled:opacity-50 transition-all min-h-[48px] max-h-[160px]
                       leading-relaxed scrollbar-none"
            style={{ height: '48px' }}
          />

          {streaming ? (
            <button
              onClick={stopStreaming}
              className="w-10 h-10 flex items-center justify-center bg-red-500/10 border
                         border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/20
                         transition-all shrink-0 active:scale-95"
              title="Stop"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            </button>
          ) : (
            <button
              onClick={() => send()}
              disabled={!input.trim()}
              className="w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-500
                         text-white rounded-xl disabled:opacity-35 transition-all
                         active:scale-95 shadow-sm shrink-0"
              title="Send (Enter)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none"/>
              </svg>
            </button>
          )}
        </div>

        {/* Char count */}
        {input.length > 480 && (
          <p className="text-xs text-faint text-right mt-1 mr-12">
            {600 - input.length} left
          </p>
        )}
      </div>
    </div>
  );
}
