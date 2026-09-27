'use client';

import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ViewHeader } from '@/components/views/ViewHeader';
import { readAiPrefs, readOwnKey, serverAiPrefs, subscribeAiPrefs, subscribeOwnKey, writeAiPrefs, writeOwnKey } from '@/lib/ai/prefs';
import { useT } from '@/lib/i18n/useT';
import type { AiPreferences } from '@/types/domain';

export function AiView() {
  const t = useT();
  const prefs = useSyncExternalStore(subscribeAiPrefs, readAiPrefs, serverAiPrefs);
  const storedKey = useSyncExternalStore(subscribeOwnKey, readOwnKey, () => '');
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const ownKey = draftKey ?? storedKey;
  const save = (next: AiPreferences) => writeAiPrefs(next);
  return (
    <>
      <ViewHeader title={t('views.ai.title')} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-semibold">{t('aiPanel.provider')}</h2>
          {(['claude', 'browser', 'local-server'] as const).map((provider) => (
            <label key={provider} className="flex items-center gap-2 text-[14px]">
              <input type="radio" name="ai-provider" checked={prefs.provider === provider} onChange={() => save({ ...prefs, provider })} />
              {t(`aiPanel.${provider === 'local-server' ? 'local' : provider}`)}
            </label>
          ))}
          <label className="flex items-center gap-2 text-[14px]">
            <input
              type="checkbox"
              checked={prefs.claude.useOwnKey}
              onChange={(e) => save({ ...prefs, claude: { useOwnKey: e.target.checked } })}
            />
            {t('aiPanel.ownKey')}
          </label>
          <Input
            type="password"
            aria-label={t('aiPanel.ownKey')}
            value={ownKey}
            onChange={(e) => setDraftKey(e.target.value)}
            onBlur={() => {
              writeOwnKey(ownKey);
              setDraftKey(null);
            }}
          />
          <Input
            aria-label={t('aiPanel.baseUrl')}
            value={prefs.localServer.baseUrl}
            onChange={(e) => save({ ...prefs, localServer: { ...prefs.localServer, baseUrl: e.target.value } })}
          />
          <Input
            aria-label={t('aiPanel.modelId')}
            value={prefs.browser.modelId ?? ''}
            placeholder="Llama-3.2-1B-Instruct-q4f32_1-MLC"
            onChange={(e) => save({ ...prefs, browser: { modelId: e.target.value } })}
          />
        </Card>
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-semibold">{t('aiPanel.privacyTitle')}</h2>
          <p className="text-[14px] text-fg-2">{t('aiPanel.privacyBody')}</p>
          <Button
            variant="soft"
            onClick={() => {
              writeOwnKey('');
              setDraftKey(null);
            }}
          >
            {t('aiPanel.clearKey')}
          </Button>
        </Card>
      </div>
    </>
  );
}
