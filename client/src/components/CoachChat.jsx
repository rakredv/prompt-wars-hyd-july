import React, { useState, useEffect, useRef } from 'react';
import { getChatHistory, addChatMessage, clearChatHistory, getHealthData } from '../services/firestore';
import { API_BASE } from '../config';

const WELCOME_MSG = {
  id: 'welcome', role: 'assistant',
  content: "Hi! I'm your MindYou coach 👋 I'm here to help you understand your habits and make meaningful changes — at your own pace. What's on your mind today?",
  created_at: new Date(),
};

const QUICK_PROMPTS = [
  'How am I doing this week?',
  'I want to reduce screen time',
  'Give me a mindfulness tip',
  'Why do I keep picking up my phone?',
];

export default function CoachChat({ user, demoMode, showToast }) {
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const history = await getChatHistory(user.uid, demoMode);
        if (history.length > 0) setMessages([WELCOME_MSG, ...history]);
      } catch (e) { console.error('Chat load error:', e); }
    };
    load();
  }, [user.uid, demoMode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const tempMsg = { id: Date.now(), role: 'user', content: text, created_at: new Date() };
    setMessages(prev => [...prev, tempMsg]);
    setInput('');
    setSending(true);
    setIsTyping(true);

    try {
      // Save user message to Firestore
      await addChatMessage(user.uid, 'user', text, demoMode);

      // Build health summary for context
      const recentData = await getHealthData(user.uid, demoMode, 3);
      const healthSummary = recentData.length
        ? recentData.map(d => `Screen: ${d.screen_time_minutes}min, Steps: ${d.steps}, Sleep: ${d.sleep_hours}h`).join(' | ')
        : 'No health data yet';

      // Get last 10 messages for context
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));

      // Call backend AI
      const token = await user.getIdToken();
      const res = await fetch(`${API_BASE}/api/ai/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, history, healthSummary }),
      });

      if (!res.ok) throw new Error('Coach unavailable');
      const data = await res.json();

      // Save assistant message to Firestore
      await addChatMessage(user.uid, 'assistant', data.response, demoMode);

      setIsTyping(false);
      setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', content: data.response, created_at: new Date() }]);
    } catch (e) {
      setIsTyping(false);
      const isNetworkError = e.name === 'TypeError' && e.message.includes('fetch');
      showToast(isNetworkError ? 'Backend is unreachable. Is your Railway app running?' : 'Coach unavailable: ' + e.message, 'error');
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleClear = async () => {
    if (!confirm('Clear chat history?')) return;
    await clearChatHistory(user.uid, demoMode);
    setMessages([WELCOME_MSG]);
    showToast('Chat cleared', 'info');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', height: 'calc(100vh - 140px)' }}>
      {messages.length <= 1 && (
        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
          {QUICK_PROMPTS.map(p => (
            <button key={p} className="btn btn-secondary btn-sm" onClick={() => { setInput(p); inputRef.current?.focus(); }}>{p}</button>
          ))}
        </div>
      )}

      <div className="chat-container" role="region" aria-label="AI Coach Chat" style={{ flex: 1 }}>
        <div style={{ padding: 'var(--space-md) var(--space-lg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-start), var(--accent-end))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🧠</div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>MindYou Coach</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)' }} />Online
              </div>
            </div>
          </div>
          <button id="btn-clear-chat" className="btn btn-ghost btn-sm" onClick={handleClear}>Clear</button>
        </div>

        <div className="chat-messages" role="log" aria-live="polite">
          {messages.map(msg => (
            <div key={msg.id} className={`message-bubble ${msg.role}`}>
              <div className="message-content">{msg.content}</div>
              <time className="message-time">
                {(msg.created_at?.toDate?.() || msg.created_at instanceof Date ? msg.created_at : new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
          ))}
          {isTyping && (
            <div className="message-bubble assistant">
              <div className="typing-indicator"><div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" /></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-area">
          <input id="chat-input" ref={inputRef} className="chat-input" type="text"
            placeholder="Ask your coach anything..." value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            disabled={sending} maxLength={1000} />
          <button id="btn-send-message" className="chat-send-btn" onClick={handleSend} disabled={sending || !input.trim()}>
            {sending ? '⏳' : '↑'}
          </button>
        </div>
      </div>
    </div>
  );
}
