'use client';

import { Card } from '@/components/ui/card';
import { ViewHeader } from '@/components/views/ViewHeader';
import { useT } from '@/lib/i18n/useT';

const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL ?? 'https://github.com/makrpai/dashthedata';
const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0';

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="nm-raised-sm rounded-[6px] px-1.5 py-0.5 font-mono text-[12px] text-fg">{children}</kbd>
  );
}

export function HelpView() {
  const t = useT();
  const steps = [
    t('help.quickStartSteps.one'),
    t('help.quickStartSteps.two'),
    t('help.quickStartSteps.three'),
    t('help.quickStartSteps.four'),
  ];
  const shortcuts: Array<[React.ReactNode, string]> = [
    [<Kbd key="k">[</Kbd>, t('help.shortcutSidebar')],
    [
      <span key="k" className="flex gap-1">
        <Kbd>Ctrl/⌘</Kbd>
        <Kbd>Z</Kbd>
      </span>,
      t('help.shortcutUndo'),
    ],
    [
      <span key="k" className="flex gap-1">
        <Kbd>Ctrl/⌘</Kbd>
        <Kbd>Shift</Kbd>
        <Kbd>Z</Kbd>
      </span>,
      t('help.shortcutRedo'),
    ],
    [<Kbd key="k">Esc</Kbd>, t('help.shortcutClearFilter')],
  ];
  return (
    <>
      <ViewHeader title={t('views.help.title')} />
      <div className="grid max-w-3xl gap-5">
        <Card className="p-5">
          <h2 className="mb-3 text-[17.5px] font-bold">{t('help.quickStart')}</h2>
          <ol className="flex list-decimal flex-col gap-2 pl-5 marker:font-semibold marker:text-accent-fg">
            {steps.map((s) => (
              <li key={s} className="max-w-[72ch] pl-1">
                {s}
              </li>
            ))}
          </ol>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-[17.5px] font-bold">{t('help.shortcuts')}</h2>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3">
            {shortcuts.map(([keys, label]) => (
              <div key={label} className="contents">
                <dt>{keys}</dt>
                <dd className="text-fg-2">{label}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-[17.5px] font-bold">{t('help.about')}</h2>
          <p className="max-w-[72ch] text-fg-2">{t('help.aboutText')}</p>
          <p className="mt-3 flex flex-wrap gap-4">
            <a
              className="font-semibold text-accent-fg underline-offset-4 hover:underline"
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
            >
              {t('help.github')}
            </a>
            <span className="text-fg-2">{t('help.version', { version: VERSION })}</span>
          </p>
        </Card>
      </div>
    </>
  );
}
