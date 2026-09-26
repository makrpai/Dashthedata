'use client';

import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { useT } from '@/lib/i18n/useT';
import { useProjectStore } from '@/store';
import type { ProjectSettings } from '@/types/domain';
import { SettingRow, SettingsSection } from './SettingsSections';

export function DataSettings() {
  const t = useT();
  const settings = useProjectStore((s) => s.project?.settings);
  const updateSettings = useProjectStore((s) => s.updateSettings);
  const disabled = !settings;
  return (
    <SettingsSection title={t('settings.storage')}>
      <SettingRow
        label={t('settings.dataFormat')}
        hint={t('settings.dataFormatHint')}
        control={
          <Segmented<ProjectSettings['dataLocale']>
            ariaLabel={t('settings.dataFormat')}
            value={settings?.dataLocale ?? 'auto'}
            onChange={(v) => !disabled && updateSettings({ dataLocale: v })}
            options={[
              { value: 'auto', label: t('settings.dataFormatAuto') },
              { value: 'fi', label: t('settings.dataFormatFi') },
              { value: 'en', label: t('settings.dataFormatEn') },
            ]}
          />
        }
      />
      <SettingRow
        id="remember-data"
        label={t('settings.rememberData')}
        hint={t('settings.rememberDataHint')}
        control={
          <Switch
            aria-labelledby="remember-data"
            disabled={disabled}
            checked={settings?.rememberData ?? true}
            onCheckedChange={(v) => updateSettings({ rememberData: v })}
          />
        }
      />
    </SettingsSection>
  );
}
