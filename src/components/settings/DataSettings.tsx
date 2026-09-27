'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/sonner';
import { refreshProjectList } from '@/components/providers/ProjectPersistence';
import { parseProjectFile, PROJECT_FILE_EXT, toProjectFile } from '@/lib/persistence/projectFile';
import { downloadBlob, safeFileName } from '@/lib/export/csv';
import { useT } from '@/lib/i18n/useT';
import { clearEverything, importProjectObject } from '@/lib/workspace/projects';
import { useProjectStore } from '@/store';
import type { ProjectSettings } from '@/types/domain';
import { SettingRow, SettingsSection } from './SettingsSections';

export function DataSettings() {
  const t = useT();
  const project = useProjectStore((s) => s.project);
  const settings = project?.settings;
  const updateSettings = useProjectStore((s) => s.updateSettings);
  const disabled = !settings;
  const [confirmClear, setConfirmClear] = useState(false);

  const exportProject = () => {
    if (!project) return;
    downloadBlob(toProjectFile(project), `${safeFileName(project.name)}.dtd.json`, 'application/json');
  };
  const importProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `${PROJECT_FILE_EXT},.json,application/json`;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const parsed = parseProjectFile(await file.text());
        await importProjectObject(parsed);
        await refreshProjectList();
        toast.success(t('project.imported'));
      } catch {
        toast.error(t('project.importFailed'));
      }
    };
    input.click();
  };

  return (
    <>
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
      <SettingRow
        label={t('settings.project')}
        control={
          <div className="flex gap-2">
            <Button variant="soft" size="sm" disabled={disabled} onClick={exportProject}>
              {t('settings.exportProject')}
            </Button>
            <Button variant="soft" size="sm" onClick={importProject}>
              {t('settings.importProject')}
            </Button>
          </div>
        }
      />
      <SettingRow
        label={t('settings.clearAll')}
        control={
          <Button variant="destructive" size="sm" onClick={() => setConfirmClear(true)}>
            {t('settings.clearAll')}
          </Button>
        }
      />
    </SettingsSection>
    <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('settings.clearAll')}</DialogTitle>
          <DialogDescription>{t('settings.clearAllConfirm')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setConfirmClear(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              await clearEverything();
              await refreshProjectList();
              setConfirmClear(false);
              toast.success(t('settings.cleared'));
            }}
          >
            {t('common.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
