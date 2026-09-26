'use client';

import { Segmented } from '@/components/ui/segmented';
import { useLocale, useT } from '@/lib/i18n/useT';
import type { Locale } from '@/lib/i18n';

export function LanguageSwitch({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const t = useT();
  return (
    <Segmented<Locale>
      className={className}
      size="sm"
      ariaLabel={t('language.switchTo')}
      value={locale}
      onChange={setLocale}
      options={[
        { value: 'fi', label: 'FI', ariaLabel: t('language.fi') },
        { value: 'en', label: 'EN', ariaLabel: t('language.en') },
      ]}
    />
  );
}
