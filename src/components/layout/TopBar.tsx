'use client';

import { Menu } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useT } from '@/lib/i18n/useT';
import { useUiStore } from '@/store/ui';
import { AskBar } from './AskBar';
import { Breadcrumbs } from './Breadcrumbs';
import { SidebarContent } from './Sidebar';

const ACTIONS_ID = 'dtd-topbar-actions';
const noopSubscribe = () => () => undefined;

/** Lets a view put its own buttons (refresh, export…) into the top bar. */
export function TopBarActions({ children }: { children: React.ReactNode }) {
  const target = useSyncExternalStore(
    noopSubscribe,
    () => document.getElementById(ACTIONS_ID),
    () => null,
  );
  return target ? createPortal(children, target) : null;
}

export function TopBar() {
  const t = useT();
  const open = useUiStore((s) => s.mobileNavOpen);
  const setOpen = useUiStore((s) => s.setMobileNavOpen);
  return (
    <header className="flex flex-col gap-3 px-4 pt-3 md:px-6 md:pt-4">
      <div className="flex min-h-10 items-center gap-3">
        <Button
          variant="soft"
          size="icon"
          className="md:hidden"
          aria-label={t('nav.openMenu')}
          onClick={() => setOpen(true)}
        >
          <Menu aria-hidden />
        </Button>
        <div className="min-w-0 flex-1">
          <Breadcrumbs />
        </div>
        <div id={ACTIONS_ID} className="flex items-center gap-2" />
      </div>
      <AskBar />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" closeLabel={t('common.close')} className="p-3" aria-describedby={undefined}>
          <SheetTitle className="sr-only">{t('nav.label')}</SheetTitle>
          <SidebarContent mode="drawer" onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
