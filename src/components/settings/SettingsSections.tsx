'use client';

import { Card } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { ViewHeader } from '@/components/views/ViewHeader';
import { useLocale, useT } from '@/lib/i18n/useT';
import type { Locale } from '@/lib/i18n';
import { useUiStore, type ContrastPref, type ThemePref } from '@/store/ui';
import { DataSettings } from './DataSettings';

export function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="mb-4 text-[17.5px] font-bold">{title}</h2>
      <div className="flex flex-col gap-5">{children}</div>
    </Card>
  );
}

export function SettingRow({
  label,
  hint,
  control,
  id,
}: {
  label: string;
  hint?: string;
  control: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 max-w-[60ch]">
        <p id={id} className="font-semibold">
          {label}
        </p>
        {hint && <p className="text-[13px] text-fg-2">{hint}</p>}
      </div>
      {control}
    </div>
  );
}

export function SettingsSections() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const theme = useUiStore((s) => s.theme);
  const contrast = useUiStore((s) => s.contrast);
  const setTheme = useUiStore((s) => s.setTheme);
  const setContrast = useUiStore((s) => s.setContrast);
  return (
    <>
      <ViewHeader title={t('views.settings.title')} />
      <div className="grid max-w-3xl gap-5">
        <SettingsSection title={t('settings.appearance')}>
          <SettingRow
            label={t('settings.language')}
            control={
              <Segmented<Locale>
                ariaLabel={t('settings.language')}
                value={locale}
                onChange={setLocale}
                options={[
                  { value: 'fi', label: t('language.fi') },
                  { value: 'en', label: t('language.en') },
                ]}
              />
            }
          />
          <SettingRow
            label={t('theme.label')}
            control={
              <Segmented<ThemePref>
                ariaLabel={t('theme.label')}
                value={theme}
                onChange={setTheme}
                options={[
                  { value: 'light', label: t('theme.light') },
                  { value: 'dark', label: t('theme.dark') },
                  { value: 'system', label: t('theme.system') },
                ]}
              />
            }
          />
          <SettingRow
            label={t('theme.contrast')}
            control={
              <Segmented<ContrastPref>
                ariaLabel={t('theme.contrast')}
                value={contrast}
                onChange={setContrast}
                options={[
                  { value: 'normal', label: t('theme.contrastNormal') },
                  { value: 'high', label: t('theme.contrastHigh') },
                ]}
              />
            }
          />
        </SettingsSection>
        <DataSettings />
      </div>
    </>
  );
}
