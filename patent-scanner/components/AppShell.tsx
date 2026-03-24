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

  const deleteChat = (id: string) => {
    storage.deleteChat(id);
    refreshChats();
    if (activeChatId === id) {
      setActiveChatId(null);
      setPage('home');
    }
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
        onDeleteChat={deleteChat}
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
