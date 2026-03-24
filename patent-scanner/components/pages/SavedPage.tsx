'use client';
import { useState, useEffect } from 'react';
import { storage } from '@/lib/storage';
import { SavedPatent } from '@/lib/types';

export default function SavedPage() {
  const [saved, setSaved] = useState<SavedPatent[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setSaved(storage.getSaved());
  }, []);

  const filtered = saved.filter(p =>
    !search ||
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.assignee.toLowerCase().includes(search.toLowerCase())
  );

  const remove = (id: string) => {
    storage.removePatent(id);
    setSaved(storage.getSaved());
  };

  return (
    <div style={{ padding: '32px 40px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Saved Patents</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {saved.length} patent{saved.length !== 1 ? 's' : ''} flagged for review
          </p>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search patents..."
          style={{ padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 2, background: 'var(--surface)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: 13, outline: 'none', width: 220, flexShrink: 0 }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--text-muted)', fontSize: 14 }}>
          {search ? 'No patents match your search.' : 'No saved patents yet. Bookmark patents from chat scans.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {filtered.map(patent => (
            <div key={patent.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: '15px 17px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <a
                  href={patent.googlePatentsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none', lineHeight: 1.4, flex: 1, marginRight: 10 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                >
                  {patent.title}
                </a>
                <button
                  onClick={() => remove(patent.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, flexShrink: 0, lineHeight: 1, fontFamily: 'var(--font-sans)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                >×</button>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 9 }}>
                {patent.assignee} · Filed {patent.filingDate}
              </div>

              {patent.similarityReason && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', padding: '8px 10px', background: 'var(--black)', border: '1px solid var(--border)', borderRadius: 2, lineHeight: 1.5, marginBottom: 10 }}>
                  {patent.similarityReason}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 9, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  From: <span style={{ color: 'var(--text-secondary)' }}>{patent.chatTitle || 'Scan'}</span>
                </div>
                <a
                  href={patent.googlePatentsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 2 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                >
                  View ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
