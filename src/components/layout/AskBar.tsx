'use client';

import { usePathname, useRouter } from 'next/navigation';
import { MessageSquareText } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/lib/i18n/useT';

/** Question field in the top bar (15.4). Submitting opens the Ask view with the question. */
export function AskBar() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState('');
  if (pathname.startsWith('/workspace/ask')) return null;
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (!q) return;
        router.push(`/workspace/ask?q=${encodeURIComponent(q)}`);
        setValue('');
      }}
      className="nm-inset flex h-11 items-center gap-2 rounded-full px-4"
    >
      <MessageSquareText className="size-4 shrink-0 text-slate" aria-hidden />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('topbar.askPlaceholder')}
        aria-label={t('nav.ask')}
        maxLength={300}
        className="h-full w-full bg-transparent text-[14px] outline-none placeholder:text-fg-2/80"
      />
    </form>
  );
}
