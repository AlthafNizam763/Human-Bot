import { create } from 'zustand';

interface AppState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  activeContactId: string | null;
  setActiveContactId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Defaults to dark mode for premium look
  theme: 'dark',
  
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(newTheme);
      localStorage.setItem('theme', newTheme);
    }
    return { theme: newTheme };
  }),

  setTheme: (theme) => set(() => {
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
      localStorage.setItem('theme', theme);
    }
    return { theme };
  }),

  activeContactId: null,
  setActiveContactId: (id) => set({ activeContactId: id }),
}));
