'use client';
import { Chat } from '@/lib/types';
import { Page } from './AppShell';

interface Props {
  page: Page;
  navTo: (p: Page) => void;
  chats: Chat[];
  activeChatId: string | null;
  onOpenChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
}

const s = {
  sidebar: { width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-width)', background: 'var(--black-soft)', borderRight: '1px solid var(--border)', padding: '24px 0', display: 'flex', flexDirection: 'column' as const, height: '100vh', overflowY: 'auto' as const },
  brand: { fontSize: 16, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' as const, padding: '0 24px', marginBottom: 36, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' },
  sectionLabel: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '1.5px', color: 'var(--text-muted)', padding: '0 24px', margin: '24px 0 8px' },
  footer: { marginTop: 'auto', padding: '16px 24px', borderTop: '1px solid var(--border)' },
  avatar: { width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-active)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 },
};

function NavItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 24px', fontSize: 13, fontWeight: 500, color: active ? 'var(--text-primary)' : 'var(--text-secondary)', background: active ? 'var(--surface-active)' : 'transparent', borderLeft: `2px solid ${active ? 'var(--white)' : 'transparent'}`, cursor: 'pointer', transition: 'all 0.1s', userSelect: 'none' }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <span style={{ fontSize: 14, color: 'var(--text-muted)', width: 18, textAlign: 'center' }}>{icon}</span>
      {label}
    </div>
  );
}

export default function Sidebar({ page, navTo, chats, activeChatId, onOpenChat, onNewChat, onDeleteChat }: Props) {
  return (
    <div style={s.sidebar}>
      <div style={s.brand}>
        PAT<span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>ALERT</span>
      </div>

      <nav>
        <NavItem icon="⌂" label="Home" active={page === 'home'} onClick={() => navTo('home')} />
        <NavItem icon="◇" label="Saved" active={page === 'saved'} onClick={() => navTo('saved')} />
      </nav>

      <div style={s.sectionLabel}>Chats</div>

      <div
        onClick={onNewChat}
        style={{ padding: '7px 24px', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 8 }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
      >
        + New scan
      </div>

      {chats.map(chat => (
        <div
          key={chat.id}
          onClick={() => onOpenChat(chat.id)}
          style={{ padding: '6px 24px', fontSize: 12, fontWeight: 500, color: activeChatId === chat.id ? 'var(--text-primary)' : 'var(--text-secondary)', background: activeChatId === chat.id ? 'var(--surface-active)' : 'transparent', borderLeft: `2px solid ${activeChatId === chat.id ? 'var(--white)' : 'transparent'}`, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'all 0.1s', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}
          onMouseEnter={e => { if (activeChatId !== chat.id) (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
          onMouseLeave={e => { if (activeChatId !== chat.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.title || 'Untitled scan'}</span>
          <button
            onClick={e => { e.stopPropagation(); onDeleteChat(chat.id); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, flexShrink: 0, lineHeight: 1, fontFamily: 'var(--font-sans)', padding: '0 2px', opacity: 0.5, transition: 'opacity 0.1s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; }}
          >×</button>
        </div>
      ))}

      <div style={s.footer}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={s.avatar}>T</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Tejas</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Imperial · MSc</div>
          </div>
        </div>
      </div>
    </div>
  );
}
