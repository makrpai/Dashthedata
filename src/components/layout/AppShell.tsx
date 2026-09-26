'use client';

import { useEffect } from 'react';
import { Sidebar, useSidebarCollapsed } from './Sidebar';
import { TopBar } from './TopBar';
import { useUiStore } from '@/store/ui';

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** Workspace frame: left sidebar + top bar + active view (17.1). */
export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useSidebarCollapsed();
  const setCollapsed = useUiStore((s) => s.setSidebarCollapsed);

  // `[` toggles the sidebar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      e.preventDefault();
      setCollapsed(!collapsed);
      document.documentElement.dataset.sidebar = collapsed ? 'expanded' : 'collapsed';
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [collapsed, setCollapsed]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main id="main" className="min-w-0 flex-1 px-4 py-4 md:px-6 md:py-5">
          {children}
        </main>
      </div>
    </div>
  );
}
