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
