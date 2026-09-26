'use client';

import { create } from 'zustand';

export type ThemePref = 'light' | 'dark' | 'system';
export type ContrastPref = 'normal' | 'high';

import { CONTRAST_KEY, SIDEBAR_KEY, THEME_KEY } from '@/lib/prefs';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

interface UiState {
  hydrated: boolean;
  theme: ThemePref;
  contrast: ContrastPref;
  /** null = not chosen by the user; the layout picks a default from the viewport width. */
  sidebarCollapsed: boolean | null;
  mobileNavOpen: boolean;
  /** Last breadcrumb part set by the active view (e.g. dataset or dashboard name). */
  breadcrumbExtra: string | null;
  setBreadcrumbExtra: (value: string | null) => void;
  hydrate: () => void;
  setTheme: (theme: ThemePref) => void;
  setContrast: (contrast: ContrastPref) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  hydrated: false,
  theme: 'system',
  contrast: 'normal',
  sidebarCollapsed: null,
  mobileNavOpen: false,
  breadcrumbExtra: null,
  setBreadcrumbExtra: (value) => set({ breadcrumbExtra: value }),
  hydrate: () => {
    const theme = read(THEME_KEY);
    const contrast = read(CONTRAST_KEY);
    const sidebar = read(SIDEBAR_KEY);
    set({
      hydrated: true,
      theme: theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system',
      contrast: contrast === 'high' ? 'high' : 'normal',
      sidebarCollapsed: sidebar === 'collapsed' ? true : sidebar === 'expanded' ? false : null,
    });
  },
  setTheme: (theme) => {
    write(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
    set({ theme });
  },
  setContrast: (contrast) => {
    write(CONTRAST_KEY, contrast);
    document.documentElement.dataset.contrast = contrast;
    set({ contrast });
  },
  setSidebarCollapsed: (collapsed) => {
    write(SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded');
    set({ sidebarCollapsed: collapsed });
  },
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
}));
