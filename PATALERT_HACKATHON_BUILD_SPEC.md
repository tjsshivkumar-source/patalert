# PatentScan — MVP Build Spec
**Hackathon:** Anthropic × Imperial Claude Code  
**Stack:** Next.js 15 (App Router) · TypeScript · Chakra Petch · Claude API · USPTO ODP API · localStorage  
**Hard deadline:** 7:00 PM — stop building at 6:30, record demo, submit Devpost

---

## Start immediately — run these now

```bash
npx create-next-app@latest patent-scanner --typescript --tailwind --app --no-src-dir
cd patent-scanner
npm install @anthropic-ai/sdk
```

Create `.env.local` in project root:
```
ANTHROPIC_API_KEY=your_anthropic_key_here
USPTO_API_KEY=yzhtgkbsugsbvwxusnvddjjazuz
```

Add to `.gitignore`:
```
.env.local
```

Open second terminal, run dev server with hot reload:
```bash
npm run dev
```

Keep `localhost:3000` open in browser the whole time. Every file save updates live.

---

## Opening prompt for Claude Code

Paste this as your very first message. Do not add anything else — let it run:

```
Build the PatentScan app in this repo following HACKATHON_BUILD_SPEC.md exactly.

Work through files in this exact order, completing each fully before moving on:
1. next.config.ts — add standalone output
2. app/globals.css — full design system
3. lib/types.ts
4. lib/storage.ts
5. app/api/scan/route.ts
6. app/layout.tsx
7. app/page.tsx
8. components/AppShell.tsx
9. components/Sidebar.tsx
10. components/pages/HomePage.tsx
11. components/pages/ChatPage.tsx
12. components/chat/AnalysisMessage.tsx
13. components/chat/PatentLinkMessage.tsx
14. components/pages/SavedPage.tsx

After each file, confirm it is complete and move to the next without asking questions.
Run `npm run build` only after all files are done to catch type errors.
The dev server is already running on port 3000 — do not restart it.
```

---

## next.config.ts

```typescript
import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  output: 'standalone',
};
export default nextConfig;
```

---

## Design System — `app/globals.css`

```css
@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');

:root {
  --black: #0A0A0A;
  --black-soft: #111111;
  --surface: #181818;
  --surface-hover: #222222;
  --surface-active: #2A2A2A;
  --border: #2A2A2A;
  --border-hover: #3A3A3A;
  --text-primary: #F0F0F0;
  --text-secondary: #999999;
  --text-muted: #666666;
  --white: #F0F0F0;
  --font-sans: 'Chakra Petch', system-ui, sans-serif;
  --sidebar-width: 220px;
  --risk-low: #4ade80;
  --risk-medium: #fbbf24;
  --risk-high: #f87171;
  --risk-critical: #ef4444;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: var(--font-sans);
  color: var(--text-primary);
  background: var(--black);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
  height: 100vh;
}

::selection { background: rgba(255,255,255,0.15); }

::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: var(--border-hover); }
```

---

## `lib/types.ts`

```typescript
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Patent {
  id: string;
  title: string;
  filingDate: string;
  assignee: string;
  status: string;
  patentNumber: string | null;
  googlePatentsUrl: string;
  similarityReason: string;
}

export interface Message {
  id: string;
  type: 'user' | 'analysis' | 'patent-link';
  content: string;
  patent?: Patent;
  imageEmoji?: string;
  imageName?: string;
  timestamp: number;
}

export interface ScanResult {
  riskLevel: RiskLevel;
  riskScore: number;
  summary: string;
  elementRisks: { element: string; risk: RiskLevel; reasoning: string }[];
  patents: Patent[];
  recommendations: string[];
  disclaimer: string;
  dataSource: 'live' | 'training';
}

export interface Chat {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
}

export interface SavedPatent extends Patent {
  savedAt: number;
  chatId: string;
  chatTitle: string;
}
```

---

## `lib/storage.ts`

```typescript
import { Chat, SavedPatent } from './types';

const CHATS_KEY = 'ps_chats';
const SAVED_KEY = 'ps_saved';

export const storage = {
  getChats: (): Chat[] => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(CHATS_KEY) || '[]'); }
    catch { return []; }
  },
  saveChat: (chat: Chat): void => {
    const chats = storage.getChats();
    const idx = chats.findIndex(c => c.id === chat.id);
    if (idx >= 0) chats[idx] = chat; else chats.unshift(chat);
    localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
  },
  deleteChat: (id: string): void => {
    const chats = storage.getChats().filter(c => c.id !== id);
    localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
  },
  getSaved: (): SavedPatent[] => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); }
    catch { return []; }
  },
  savePatent: (patent: SavedPatent): void => {
    const saved = storage.getSaved();
    if (!saved.find(p => p.id === patent.id)) {
      saved.unshift(patent);
      localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    }
  },
  removePatent: (id: string): void => {
    const saved = storage.getSaved().filter(p => p.id !== id);
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  },
  isPatentSaved: (id: string): boolean => {
    return storage.getSaved().some(p => p.id === id);
  },
};
```

---

## `app/api/scan/route.ts`

Three sequential steps: Claude vision → USPTO live search (with retry) → Claude risk assessment.

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { Patent, ScanResult } from '@/lib/types';

const client = new Anthropic();

async function extractElements(imageBase64: string, mediaType: string, description: string) {
  const content: Anthropic.MessageParam['content'] = [];

  if (imageBase64) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: imageBase64 }
    });
  }

  content.push({
    type: 'text',
    text: `You are a design patent expert. Analyze this fashion/product${imageBase64 ? ' image and' : ''} description: "${description}"

Return ONLY valid JSON, no markdown fences:
{
  "category": "apparel|footwear|handbag|accessory|jewelry|eyewear|other",
  "silhouette": "overall shape and proportions in one sentence",
  "surface_pattern": "surface ornamentation, texture, or pattern — or none",
  "hardware": "hardware elements and their placement — or none",
  "seam_lines": "stitching patterns and panel construction — or none",
  "distinctive_elements": ["3-5 most distinctive ornamental features as short phrases"],
  "search_keywords": ["6-8 specific USPTO search keywords focused on visual/ornamental terms"],
  "known_risks": "any elements visually resembling famous protected designs — or none"
}`
  });

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

async function searchUSPTO(keywords: string[]): Promise<{ patents: Patent[]; source: 'live' | 'training' }> {
  const trySearch = async (kws: string[]): Promise<Patent[]> => {
    const query = kws.join(' AND ');
    const params = new URLSearchParams({
      q: `(${query}) AND applicationTypeCode:DES`,
      start: '0',
      rows: '8',
      sort: 'filingDate desc'
    });

    const res = await fetch(
      `https://api.uspto.gov/api/v1/patent/applications/search?${params}`,
      {
        headers: { 'X-Api-Key': process.env.USPTO_API_KEY!, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000)
      }
    );

    if (!res.ok) throw new Error(`USPTO HTTP ${res.status}`);
    const data = await res.json();
    const bag = data.patentFileWrapperDataBag;
    if (!bag || !Array.isArray(bag)) return [];

    return bag.map((p: any) => {
      const meta = p.applicationMetaData || {};
      const appNum = p.applicationNumberText || '';
      const patentNum = meta.patentNumber || null;
      return {
        id: appNum || `pat_${Math.random().toString(36).slice(2)}`,
        title: meta.inventionTitle || 'Design Patent',
        filingDate: meta.filingDate || 'Unknown',
        assignee: meta.firstApplicantName || meta.applicantBag?.[0]?.applicantNameText || 'Unknown',
        status: meta.applicationStatusDescriptionText || 'Unknown',
        patentNumber: patentNum,
        googlePatentsUrl: patentNum
          ? `https://patents.google.com/patent/USD${patentNum}`
          : `https://ppubs.uspto.gov/pubwebapp/external.html?q=(${appNum})&db=USPAT`,
        similarityReason: ''
      };
    });
  };

  try {
    // First attempt: top 4 keywords
    let patents = await trySearch(keywords.slice(0, 4));

    // Retry with 2 keywords if no results
    if (patents.length === 0 && keywords.length > 2) {
      patents = await trySearch(keywords.slice(0, 2));
    }

    if (patents.length > 0) return { patents, source: 'live' };
    return { patents: [], source: 'training' };
  } catch (e) {
    console.error('USPTO search failed:', e);
    return { patents: [], source: 'training' };
  }
}

async function assessRisk(elements: any, patents: Patent[], source: 'live' | 'training'): Promise<ScanResult> {
  const patentContext = patents.length > 0
    ? `LIVE USPTO DESIGN PATENTS FOUND:\n${patents.map((p, i) => `${i + 1}. "${p.title}" — Filed: ${p.filingDate} — Assignee: ${p.assignee} — ID: ${p.id}`).join('\n')}`
    : `No USPTO results returned. Use your training knowledge of well-known fashion design patents to assess risk. Cite specific real patent numbers where relevant (e.g. Chanel D432220, Nike D723640, Louboutin D505085).`;

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are a design patent attorney conducting a freedom-to-operate analysis for a fashion product.

PRODUCT ORNAMENTAL ELEMENTS:
- Category: ${elements.category}
- Silhouette: ${elements.silhouette}
- Surface Pattern: ${elements.surface_pattern}
- Hardware: ${elements.hardware}
- Seam Lines: ${elements.seam_lines}
- Distinctive Elements: ${(elements.distinctive_elements || []).join(', ')}
- Known Risk Flags: ${elements.known_risks}

${patentContext}

Return ONLY valid JSON, no markdown fences:
{
  "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "riskScore": 0-100,
  "summary": "2-3 sentence plain English risk summary for a designer audience",
  "elementRisks": [
    { "element": "element name", "risk": "LOW|MEDIUM|HIGH", "reasoning": "specific reason in one sentence" }
  ],
  "patentAssessments": [
    { "patentId": "exact ID from the list above", "similarityReason": "brief specific visual similarity explanation", "recommendedAction": "one actionable step" }
  ],
  "recommendations": ["specific actionable recommendation 1", "recommendation 2", "recommendation 3"],
  "disclaimer": "This is AI-assisted preliminary analysis only. Consult qualified IP counsel before making product or manufacturing decisions."
}`
    }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  const assessment = JSON.parse(text.replace(/```json|```/g, '').trim());

  // Merge similarity reasons back into patent objects
  const enrichedPatents = patents.map(p => {
    const a = (assessment.patentAssessments || []).find((pa: any) => pa.patentId === p.id);
    return {
      ...p,
      similarityReason: a?.similarityReason || 'Ornamental similarity detected via USPTO search.'
    };
  });

  return {
    riskLevel: assessment.riskLevel || 'LOW',
    riskScore: Number(assessment.riskScore) || 0,
    summary: assessment.summary || '',
    elementRisks: assessment.elementRisks || [],
    patents: enrichedPatents,
    recommendations: assessment.recommendations || [],
    disclaimer: assessment.disclaimer || '',
    dataSource: source
  };
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType, description } = await req.json();

    if (!description && !imageBase64) {
      return NextResponse.json({ error: 'Provide a description or image' }, { status: 400 });
    }

    const elements = await extractElements(imageBase64 || '', mediaType || 'image/jpeg', description || '');
    const { patents, source } = await searchUSPTO(elements.search_keywords || []);
    const result = await assessRisk(elements, patents, source);

    return NextResponse.json({ result });
  } catch (err: any) {
    console.error('Scan error:', err);
    return NextResponse.json({ error: err.message || 'Scan failed' }, { status: 500 });
  }
}
```

---

## `app/layout.tsx`

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PatentScan',
  description: 'Scan your design against USPTO patents before you ship.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

---

## `app/page.tsx`

```tsx
import AppShell from '@/components/AppShell';

export default function Page() {
  return <AppShell />;
}
```

---

## `components/AppShell.tsx`

```tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import SavedPage from './pages/SavedPage';
import { storage } from '@/lib/storage';
import { Chat } from '@/lib/types';

export type Page = 'home' | 'chat' | 'saved';

export default function AppShell() {
  const [page, setPage] = useState<Page>('home');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);

  const refreshChats = useCallback(() => {
    setChats(storage.getChats());
  }, []);

  useEffect(() => {
    refreshChats();
  }, [refreshChats]);

  const openChat = (id: string) => {
    setActiveChatId(id);
    setPage('chat');
  };

  const newChat = () => {
    const id = `chat_${Date.now()}`;
    setActiveChatId(id);
    setPage('chat');
  };

  const navTo = (p: Page) => {
    setPage(p);
    if (p === 'home' || p === 'saved') refreshChats();
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        page={page}
        navTo={navTo}
        chats={chats}
        activeChatId={activeChatId}
        onOpenChat={openChat}
        onNewChat={newChat}
      />
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', background: 'var(--black)' }}>
        {page === 'home' && (
          <HomePage onOpenChat={openChat} onNewChat={newChat} />
        )}
        {page === 'chat' && (
          <ChatPage
            key={activeChatId}
            chatId={activeChatId}
            onChatSaved={refreshChats}
          />
        )}
        {page === 'saved' && <SavedPage />}
      </div>
    </div>
  );
}
```

---

## `components/Sidebar.tsx`

```tsx
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

export default function Sidebar({ page, navTo, chats, activeChatId, onOpenChat, onNewChat }: Props) {
  return (
    <div style={s.sidebar}>
      <div style={s.brand}>
        PATENT<span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>SCAN</span>
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
          style={{ padding: '6px 24px', fontSize: 12, fontWeight: 500, color: activeChatId === chat.id ? 'var(--text-primary)' : 'var(--text-secondary)', background: activeChatId === chat.id ? 'var(--surface-active)' : 'transparent', borderLeft: `2px solid ${activeChatId === chat.id ? 'var(--white)' : 'transparent'}`, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'all 0.1s', userSelect: 'none' }}
          onMouseEnter={e => { if (activeChatId !== chat.id) (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
          onMouseLeave={e => { if (activeChatId !== chat.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          {chat.title || 'Untitled scan'}
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
```

---

## `components/pages/HomePage.tsx`

```tsx
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
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '0.5px' }}>Patent Scanner</h1>
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
```

---

## `components/pages/ChatPage.tsx`

```tsx
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
```

---

## `components/chat/AnalysisMessage.tsx`

```tsx
import { ScanResult, RiskLevel } from '@/lib/types';

const riskColors: Record<RiskLevel, string> = {
  LOW: '#4ade80',
  MEDIUM: '#fbbf24',
  HIGH: '#f87171',
  CRITICAL: '#ef4444',
};

export function AnalysisMessage({ content }: { content: string }) {
  let result: ScanResult;
  try {
    result = JSON.parse(content);
  } catch {
    return null;
  }

  const rc = riskColors[result.riskLevel] || '#999';

  return (
    <div style={{ alignSelf: 'flex-start', maxWidth: '88%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--surface-active)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>IP</div>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Patent Analysis</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {result.dataSource === 'live' ? 'USPTO · Live Data' : 'USPTO · Training Knowledge'}
        </span>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: '14px 16px' }}>
        {/* Risk header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
          <div style={{ background: rc, color: '#000', padding: '3px 10px', borderRadius: 2, fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
            {result.riskLevel}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Risk Score: <strong style={{ color: 'var(--text-primary)' }}>{result.riskScore}/100</strong>
          </span>
        </div>

        {/* Summary */}
        <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-primary)', marginBottom: 14 }}>
          {result.summary}
        </p>

        {/* Element risks */}
        {result.elementRisks?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 8 }}>Element Analysis</div>
            {result.elementRisks.map((er, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'flex-start' }}>
                <span style={{ color: riskColors[er.risk] || '#999', fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 2, minWidth: 36 }}>{er.risk}</span>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{er.element}</strong> — {er.reasoning}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {result.recommendations?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 8 }}>Recommendations</div>
            {result.recommendations.map((r, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '3px 0', display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>→</span>
                {r}
              </div>
            ))}
          </div>
        )}

        {/* Disclaimer */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
          {result.disclaimer}
        </div>
      </div>
    </div>
  );
}
```

---

## `components/chat/PatentLinkMessage.tsx`

```tsx
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
```

---

## `components/pages/SavedPage.tsx`

```tsx
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
```

---

## USPTO API Reference

**Endpoint:** `GET https://api.uspto.gov/api/v1/patent/applications/search`  
**Auth:** `X-Api-Key: yzhtgkbsugsbvwxusnvddjjazuz`  
**Design filter:** `applicationTypeCode:DES`  
**Rate limit:** 45 req/min — well within hackathon usage

**Response fields used:**
```
.applicationNumberText                               → patent.id
.applicationMetaData.inventionTitle                  → patent.title
.applicationMetaData.filingDate                      → patent.filingDate
.applicationMetaData.firstApplicantName              → patent.assignee (primary)
.applicationMetaData.applicantBag[0].applicantNameText → patent.assignee (fallback)
.applicationMetaData.applicationStatusDescriptionText → patent.status
.applicationMetaData.patentNumber                    → patent.patentNumber
```

**Google Patents URL:**  
- If `patentNumber` exists: `https://patents.google.com/patent/USD{patentNumber}` (note the D prefix)  
- If pending: `https://ppubs.uspto.gov/pubwebapp/external.html?q=({appNum})&db=USPAT`

**Retry logic:** if 0 results with 4 keywords → retry with first 2. If still 0 → Claude uses training knowledge, `dataSource` set to `'training'`, UI shows "USPTO · Training Knowledge" instead of "USPTO · Live Data".

---

## Timeline — you have until 6:30

| Time | Milestone |
|------|-----------|
| 4:30 | `create-next-app` running, Claude Code prompt pasted |
| 5:15 | All files generated, `npm run build` passes |
| 5:30 | First real scan working end-to-end in browser |
| 6:00 | All three pages navigating correctly, bookmarks working |
| 6:20 | Run 3 demo scans, confirm risk levels look right |
| 6:30 | **Stop building. Start recording demo video.** |
| 6:50 | Submit Devpost |
| 7:00 | Done |

---

## Demo video script (2–3 min)

1. Open app on Home page — explain the problem in one sentence
2. Click New Scan — show empty chat state
3. Upload quilted bag image + type description → hit Scan
4. Watch the three loading steps in the header
5. Show the risk report — HIGH risk, element breakdown, recommendations
6. Show individual patent rows — click one to open Google Patents (live data)
7. Bookmark two patents — show the ◆ toggle
8. Navigate to Saved page — patents are there
9. Navigate to Home — right column shows saved patents, left column shows the chat
10. Done — total 2.5 min

---

## Devpost description (copy-paste ready)

**Tagline:** Scan your design against 9M+ USPTO patents before you ship.

**What it does:**
PatentScan lets fashion designers and brand teams detect potential design patent infringement before they go to market. Upload a product image, describe the design, and get a real-time risk report backed by live USPTO data — in under 30 seconds.

**How we built it:**
Claude's vision API decomposes the uploaded image into its ornamental elements — silhouette, surface pattern, hardware, seam lines. Those elements drive a live query to the USPTO Open Data Portal API, filtered specifically to design patents. Claude then acts as a design patent attorney, cross-referencing the returned patents against the extracted elements and producing a structured risk assessment with element-by-element breakdown and actionable recommendations. Each matching patent is surfaced as an individual link that opens directly in Google Patents, and users can bookmark patents for their IP team to review later.

**How we used Claude:**
Claude does two distinct jobs. First, as a vision model — analyzing product images to extract the specific ornamental elements that matter legally (not general descriptions, but the precise visual features courts look at in design patent disputes). Second, as a legal reasoning engine — not just summarizing, but applying the "ordinary observer" test used in US design patent infringement analysis to assess each element's risk level independently.

**Tech stack:** Next.js 15 · TypeScript · Anthropic Claude API · USPTO Open Data Portal API · localStorage

---

## Post-hackathon deployment (Supabase + Railway)

Do this after submission — not tonight.

### Step 1 — Dependencies
```bash
npm install prisma @prisma/client
npx prisma init
```

### Step 2 — Schema (`prisma/schema.prisma`)
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Chat {
  id        String    @id @default(cuid())
  title     String    @default("New Scan")
  createdAt DateTime  @default(now())
  messages  Message[]
}

model Message {
  id        String   @id @default(cuid())
  chatId    String
  chat      Chat     @relation(fields: [chatId], references: [id], onDelete: Cascade)
  type      String
  content   String   @db.Text
  patentId  String?
  timestamp DateTime @default(now())
  patent    Patent?  @relation(fields: [patentId], references: [id])
}

model Patent {
  id               String        @id
  title            String
  filingDate       String
  assignee         String
  status           String
  patentNumber     String?
  googlePatentsUrl String
  similarityReason String        @db.Text
  messages         Message[]
  savedPatents     SavedPatent[]
}

model SavedPatent {
  id        String   @id @default(cuid())
  patentId  String   @unique
  patent    Patent   @relation(fields: [patentId], references: [id])
  chatId    String
  chatTitle String
  savedAt   DateTime @default(now())
}
```

### Step 3 — Supabase
1. [supabase.com](https://supabase.com) → New project → Settings → Database → Connection string → URI
2. Add to `.env.local`: `DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`
3. Run: `npx prisma db push && npx prisma generate`

### Step 4 — `lib/db.ts` (Prisma singleton)
```typescript
import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### Step 5 — Dockerfile
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "server.js"]
```

Add to `.dockerignore`:
```
.env
.env.local
node_modules
.next
```

### Step 6 — Railway
1. Push repo to GitHub
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Variables tab → add `ANTHROPIC_API_KEY`, `USPTO_API_KEY`, `DATABASE_URL`
4. Deploy → live URL in ~3 minutes
5. Total estimated time: 45–90 min