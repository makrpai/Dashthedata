'use client';

import { CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/useT';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <CircleAlert className="size-8 text-danger" aria-hidden />
      <h1 className="text-[22px] font-bold">{t('errors.boundaryTitle')}</h1>
      <p className="max-w-lg text-fg-2">{t('errors.boundaryText', { message: error.message })}</p>
      <Button variant="primary" onClick={reset}>
        {t('common.retry')}
      </Button>
    </main>
  );
}
