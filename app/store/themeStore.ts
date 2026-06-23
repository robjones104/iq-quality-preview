import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeStore = {
  darkMode: boolean;
  toggle: () => void;
};

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      darkMode: true,
      toggle: () => set((s) => ({ darkMode: !s.darkMode })),
    }),
    { name: 'iq-theme' }
  )
);
