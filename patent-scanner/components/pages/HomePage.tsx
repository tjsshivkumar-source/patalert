'use client';
import { useEffect, useState } from 'react';
import { storage } from '@/lib/storage';
import { Chat, SavedPatent } from '@/lib/types';

interface Props {
  onOpenChat: (id: string) => void;
  onNewChat: () => void;
}

export default function HomePage({ onOpenChat, onNewChat }: Props) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [saved, setSaved] = useState<SavedPatent[]>([]);

  useEffect(() => {
    setChats(storage.getChats());
    setSaved(storage.getSaved());
  }, []);

  return (
    <div style={{ padding: '32px 40px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '0.5px' }}>PatAlert</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Scan your designs against live USPTO data before you ship.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, height: 'calc(100vh - 160px)' }}>
        <Column title="Recent Scans" count={chats.length}>
          <ActionCard onClick={onNewChat} />
          {chats.map(chat => (
            <MiniCard key={chat.id} onClick={() => onOpenChat(chat.id)}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{chat.title || 'Untitled scan'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {new Date(chat.createdAt).toLocaleDateString()} · {chat.messages.length} messages
              </div>
            </MiniCard>
          ))}
          {chats.length === 0 && <Empty text="No scans yet — start one above." />}
        </Column>

        <Column title="Saved Patents" count={saved.length}>
          {saved.map(p => (
            <MiniCard key={p.id} onClick={() => window.open(p.googlePatentsUrl, '_blank')}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.assignee} · {p.filingDate}</div>
              {p.similarityReason && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>
                  {p.similarityReason}
                </div>
              )}
            </MiniCard>
          ))}
          {saved.length === 0 && <Empty text="No saved patents yet. Bookmark from chat." />}
        </Column>
      </div>
    </div>
  );
}

function Column({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-secondary)' }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-active)', padding: '2px 8px', borderRadius: 2 }}>{count}</span>
      </div>
      <div style={{ padding: 10, overflowY: 'auto', flex: 1 }}>{children}</div>
    </div>
  );
}

function MiniCard({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClick}
      style={{ padding: '11px 13px', border: '1px solid var(--border)', borderRadius: 2, marginBottom: 6, cursor: 'pointer', transition: 'all 0.1s' }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border-hover)'; el.style.background = 'var(--surface-hover)'; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.background = 'transparent'; }}
    >
      {children}
    </div>
  );
}

function ActionCard({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ padding: '22px 16px', border: '1px dashed var(--border)', borderRadius: 2, textAlign: 'center', cursor: 'pointer', marginBottom: 6, transition: 'all 0.15s' }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--text-muted)'; el.style.background = 'var(--surface-hover)'; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.background = 'transparent'; }}
    >
      <div style={{ fontSize: 20, marginBottom: 6, color: 'var(--text-muted)' }}>+</div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>New Scan</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>Upload a design image and describe your product</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '18px 12px', textAlign: 'center' }}>{text}</div>;
}
