'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { storage } from '@/lib/storage';
import { Chat, Message, ScanResult } from '@/lib/types';
import { AnalysisMessage } from '@/components/chat/AnalysisMessage';
import { PatentLinkMessage } from '@/components/chat/PatentLinkMessage';

interface Props {
  chatId: string | null;
  onChatSaved: () => void;
}

const STEPS = [
  'Extracting ornamental elements...',
  'Searching USPTO design patents...',
  'Assessing infringement risk...',
];

export default function ChatPage({ chatId, onChatSaved }: Props) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [input, setInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!chatId) return;
    const existing = storage.getChats().find(c => c.id === chatId);
    setChat(existing || { id: chatId, title: '', createdAt: Date.now(), messages: [] });
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat?.messages, loading]);

  const clearImg = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
  }, []);

  const handleImage = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const send = async () => {
    if (loading || (!input.trim() && !imageFile) || !chat) return;

    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content: input || '',
      imageEmoji: imageFile ? '🖼' : undefined,
      imageName: imageFile?.name,
      timestamp: Date.now(),
    };

    const title = chat.title || input.slice(0, 42) || imageFile?.name || 'Scan';
    const updatedChat: Chat = {
      ...chat,
      title,
      messages: [...chat.messages, userMsg],
    };
    setChat(updatedChat);
    setInput('');
    setLoading(true);
    setStepIdx(0);

    stepTimer.current = setInterval(() => {
      setStepIdx(i => (i + 1) % STEPS.length);
    }, 1400);

    try {
      let imageBase64 = '';
      let mediaType = 'image/jpeg';

      if (imageFile) {
        imageBase64 = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = e => res((e.target?.result as string).split(',')[1]);
          reader.onerror = rej;
          reader.readAsDataURL(imageFile);
        });
        mediaType = imageFile.type || 'image/jpeg';
        clearImg();
      }

      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mediaType, description: input }),
      });

      if (!response.ok) throw new Error(`API error ${response.status}`);
      const { result }: { result: ScanResult } = await response.json();

      const now = Date.now();
      const analysisMsg: Message = {
        id: `msg_${now}_analysis`,
        type: 'analysis',
        content: JSON.stringify(result),
        timestamp: now,
      };
      const patentMsgs: Message[] = result.patents.map((p, i) => ({
        id: `msg_${now}_p${i}`,
        type: 'patent-link',
        content: '',
        patent: p,
        timestamp: now + i + 1,
      }));

      const finalChat: Chat = {
        ...updatedChat,
        messages: [...updatedChat.messages, analysisMsg, ...patentMsgs],
      };
      setChat(finalChat);
      storage.saveChat(finalChat);
      onChatSaved();
    } catch (err) {
      console.error('Scan failed:', err);
      const errMsg: Message = {
        id: `msg_${Date.now()}_err`,
        type: 'analysis',
        content: JSON.stringify({
          riskLevel: 'LOW', riskScore: 0,
          summary: 'Scan failed — check your API keys and try again.',
          elementRisks: [], patents: [], recommendations: [],
          disclaimer: '', dataSource: 'training'
        }),
        timestamp: Date.now(),
      };
      setChat(c => c ? { ...c, messages: [...c.messages, errMsg] } : c);
    } finally {
      if (stepTimer.current) clearInterval(stepTimer.current);
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '15px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{chat?.title || 'New Scan'}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
          {loading ? STEPS[stepIdx] : 'USPTO Live · Claude Vision'}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {(!chat || chat.messages.length === 0) && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center', gap: 10 }}>
            <div style={{ fontSize: 28 }}>⟐</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>Start a new scan</div>
            <div style={{ fontSize: 13 }}>Upload a product image and describe your design below.</div>
          </div>
        )}

        {chat?.messages.map(msg => {
          if (msg.type === 'user') return (
            <div key={msg.id} style={{ alignSelf: 'flex-end', maxWidth: '68%' }}>
              {msg.imageName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 3, background: 'var(--surface-active)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🖼</div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{msg.imageName}</span>
                </div>
              )}
              {msg.content && (
                <div style={{ background: 'var(--white)', color: '#0A0A0A', padding: '9px 14px', borderRadius: '12px 12px 2px 12px', fontSize: 13, lineHeight: 1.5 }}>
                  {msg.content}
                </div>
              )}
              <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
          if (msg.type === 'analysis') return <AnalysisMessage key={msg.id} content={msg.content} />;
          if (msg.type === 'patent-link' && msg.patent) return (
            <PatentLinkMessage
              key={msg.id}
              patent={msg.patent}
              chatId={chat.id}
              chatTitle={chat.title}
            />
          );
          return null;
        })}

        {loading && (
          <div style={{ alignSelf: 'flex-start', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: '11px 16px', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ display: 'inline-block', animation: 'spin 1.2s linear infinite' }}>◌</span>
            {STEPS[stepIdx]}
          </div>
        )}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        {imagePreview && (
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={imagePreview} alt="preview" style={{ height: 48, width: 48, objectFit: 'cover', borderRadius: 2, border: '1px solid var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{imageFile?.name}</span>
            <button onClick={clearImg} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4 }}>× remove</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleImage(e.target.files[0]); e.target.value = ''; }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload image"
            style={{ padding: '9px 13px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 17, flexShrink: 0, fontFamily: 'var(--font-sans)', lineHeight: 1 }}
          >↑</button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Upload an image · describe your design — category, materials, key ornamental features..."
            rows={2}
            style={{ flex: 1, padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 2, fontFamily: 'var(--font-sans)', fontSize: 13, outline: 'none', resize: 'none', background: 'var(--black)', color: 'var(--text-primary)' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          />
          <button
            onClick={send}
            disabled={loading || (!input.trim() && !imageFile)}
            style={{ padding: '9px 20px', background: 'var(--white)', color: '#0A0A0A', border: 'none', borderRadius: 2, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer', opacity: loading || (!input.trim() && !imageFile) ? 0.4 : 1, whiteSpace: 'nowrap', transition: 'opacity 0.15s' }}
          >Scan</button>
        </div>
      </div>
    </div>
  );
}
