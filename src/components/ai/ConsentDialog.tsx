'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useT } from '@/lib/i18n/useT';
import { useProjectStore } from '@/store';

export function ConsentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('aiPanel.consentTitle')}</DialogTitle>
          <DialogDescription>{t('aiPanel.consentBody')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              useProjectStore.getState().updateSettings({ ai: { ...useProjectStore.getState().project!.settings.ai, consentGiven: true, enabled: true } });
              onClose();
            }}
          >
            {t('aiPanel.consentAccept')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
