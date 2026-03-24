'use client';
import { useState } from 'react';
import { Patent } from '@/lib/types';
import { storage } from '@/lib/storage';

interface Props {
  patent: Patent;
  chatId: string;
  chatTitle: string;
}

export function PatentLinkMessage({ patent, chatId, chatTitle }: Props) {
  const [saved, setSaved] = useState(() => storage.isPatentSaved(patent.id));

  const toggleSave = () => {
    if (saved) {
      storage.removePatent(patent.id);
      setSaved(false);
    } else {
      storage.savePatent({ ...patent, savedAt: Date.now(), chatId, chatTitle });
      setSaved(true);
    }
  };

  return (
    <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
      <div
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: '10px 13px', display: 'flex', alignItems: 'flex-start', gap: 12, transition: 'border-color 0.1s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <a
            href={patent.googlePatentsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none', display: 'block', marginBottom: 3 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
          >
            {patent.title} ↗
          </a>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            {patent.assignee} · Filed {patent.filingDate} · {patent.id}
          </div>
          {patent.similarityReason && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              {patent.similarityReason}
            </div>
          )}
        </div>

        <button
          onClick={toggleSave}
          title={saved ? 'Remove from saved' : 'Save patent'}
          style={{ flexShrink: 0, width: 28, height: 28, background: saved ? 'var(--surface-active)' : 'transparent', border: `1px solid ${saved ? 'var(--border-hover)' : 'var(--border)'}`, borderRadius: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: saved ? 'var(--white)' : 'var(--text-muted)', transition: 'all 0.15s', fontFamily: 'var(--font-sans)' }}
        >
          {saved ? '◆' : '◇'}
        </button>
      </div>
    </div>
  );
}
