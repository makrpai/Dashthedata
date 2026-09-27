'use client';

import { useEffect } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import type { Locale } from '@/lib/i18n';
import { I18nProvider } from '@/lib/i18n/useT';
import { useUiStore } from '@/store/ui';
import { ProjectPersistence } from './ProjectPersistence';

function UiHydrator() {
  const hydrate = useUiStore((s) => s.hydrate);
  useEffect(() => hydrate(), [hydrate]);
  return null;
}

export function Providers({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <I18nProvider initialLocale={locale}>
      <TooltipProvider delayDuration={300}>
        <UiHydrator />
        <ProjectPersistence />
        {children}
        <Toaster />
      </TooltipProvider>
    </I18nProvider>
  );
}
