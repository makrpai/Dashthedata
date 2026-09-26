'use client';

import Link from 'next/link';
import { Database, FileSpreadsheet, ShieldCheck, Sparkles } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LanguageSwitch } from '@/components/layout/LanguageSwitch';
import { ThemeSwitch } from '@/components/layout/ThemeSwitch';
import { useT } from '@/lib/i18n/useT';
import { LandingDrop } from './LandingDrop';
import { RecentProjects } from './RecentProjects';

const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL ?? 'https://github.com/makrpai/dashthedata';

export function Landing() {
  const t = useT();
  const features = [
    { icon: ShieldCheck, title: t('landing.privacyTitle'), text: t('landing.privacyText') },
    { icon: Sparkles, title: t('landing.cleanTitle'), text: t('landing.cleanText') },
    { icon: Database, title: t('landing.sourcesTitle'), text: t('landing.sourcesText') },
  ];
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 md:px-8">
      <header className="flex items-center justify-between gap-3 py-5">
        <Logo size={30} />
        <div className="flex items-center gap-2">
          <LanguageSwitch />
          <ThemeSwitch />
          <Button asChild variant="soft" size="sm" className="hidden sm:inline-flex">
            <Link href="/workspace">{t('landing.openWorkspace')}</Link>
          </Button>
        </div>
      </header>

      <main id="main" className="flex flex-1 flex-col gap-16 pb-16">
        <section className="flex flex-col items-center gap-6 pt-10 text-center md:pt-16">
          <h1 className="font-display max-w-4xl text-[39px] leading-[1.1] font-bold tracking-[-0.02em] md:text-[56px]">
            {t('landing.title')}
          </h1>
          <p className="max-w-[62ch] text-[16px] text-fg-2 md:text-[20px] md:leading-[1.45]">
            {t('landing.lead')}
          </p>
          <LandingDrop />
        </section>

        <section aria-label={t('app.name')} className="grid gap-5 md:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="flex flex-col gap-3 p-6">
              <Icon className="size-6 text-accent" aria-hidden />
              <h2 className="text-[20px] font-bold">{title}</h2>
              <p className="text-[16px] text-fg-2">{text}</p>
            </Card>
          ))}
        </section>

        <RecentProjects />
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line-strong py-6 text-[14px] text-fg-2">
        <span className="flex items-center gap-2">
          <FileSpreadsheet className="size-4 text-slate" aria-hidden />
          Dash the Data · {t('landing.footerLicense')}
        </span>
        <nav className="flex gap-5" aria-label="Footer">
          <Link className="hover:text-fg" href="/privacy">
            {t('landing.footerPrivacy')}
          </Link>
          <a className="hover:text-fg" href={GITHUB_URL} target="_blank" rel="noreferrer">
            {t('landing.footerGithub')}
          </a>
        </nav>
      </footer>
    </div>
  );
}
