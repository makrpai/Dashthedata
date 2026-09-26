'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Logo } from '@/components/brand/Logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeSwitch } from '@/components/layout/ThemeSwitch';
import { LanguageSwitch } from '@/components/layout/LanguageSwitch';
import { useT } from '@/lib/i18n/useT';

/** Accent alternatives documented in the README brand section (17.3). */
const ACCENTS = {
  coral: { light: '#E85D56', dark: '#F07C74' },
  amber: { light: '#E0A526', dark: '#F2C45A' },
  teal: { light: '#1B998B', dark: '#4CC3BC' },
} as const;
type AccentName = keyof typeof ACCENTS;

export function ComponentGallery() {
  const t = useT();
  const [accent, setAccent] = useState<AccentName>('coral');
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const applyAccent = (name: AccentName) => {
    setAccent(name);
    const root = document.documentElement.style;
    root.setProperty('--brand-accent', ACCENTS[name].light);
    root.setProperty('--brand-accent-on-dark', ACCENTS[name].dark);
  };
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[27px] font-bold">{t('dev.title')}</h1>
        <div className="flex items-center gap-2">
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
      </div>
      <Card className="flex flex-wrap items-center gap-6 p-5">
        <Logo size={40} />
        <Logo variant="mark" size={40} />
        <Logo variant="mark" size={20} />
        <span className="rounded-[12px] bg-[var(--brand-ink)] p-3">
          <Logo tone="dark" size={28} />
        </span>
        <Logo tone="mono" size={28} />
        <div className="ml-auto flex items-center gap-3">
          <span className="font-semibold">{t('dev.accent')}</span>
          <Segmented<AccentName>
            ariaLabel={t('dev.accent')}
            value={accent}
            onChange={applyAccent}
            options={[
              { value: 'coral', label: t('dev.accentCoral') },
              { value: 'amber', label: t('dev.accentAmber') },
              { value: 'teal', label: t('dev.accentTeal') },
            ]}
          />
        </div>
      </Card>
      <Card className="flex flex-col gap-4 p-5">
        <h2 className="text-[17.5px] font-bold">{t('dev.buttons')}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">{t('dev.primary')}</Button>
          <Button variant="soft">{t('dev.soft')}</Button>
          <Button variant="ghost">{t('dev.ghost')}</Button>
          <Button variant="destructive">
            <Trash2 aria-hidden />
            {t('dev.destructive')}
          </Button>
          <Button variant="link">Link</Button>
          <Button variant="soft" disabled>
            Disabled
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Default</Badge>
          <Badge variant="accent">AI</Badge>
          <Badge variant="success">OK</Badge>
          <Badge variant="danger">Error</Badge>
          <Badge variant="muted">Muted</Badge>
        </div>
      </Card>
      <Card className="grid gap-4 p-5 md:grid-cols-2">
        <h2 className="text-[17.5px] font-bold md:col-span-2">{t('dev.inputs')}</h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="g-input">Input</Label>
          <Input id="g-input" placeholder={t('dev.placeholder')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Select</Label>
          <Select defaultValue="a">
            <SelectTrigger aria-label="Select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a">Helsinki</SelectItem>
              <SelectItem value="b">Tampere</SelectItem>
              <SelectItem value="c">Turku</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea placeholder={t('dev.placeholder')} aria-label="Textarea" />
        <div className="flex flex-wrap items-center gap-4">
          <Switch aria-label="Switch" defaultChecked />
          <Switch aria-label="Switch off" />
          <Segmented
            ariaLabel="Segmented"
            value={seg}
            onChange={setSeg}
            options={[
              { value: 'a', label: 'Day' },
              { value: 'b', label: 'Week' },
              { value: 'c', label: 'Month' },
            ]}
          />
          <Tabs defaultValue="before">
            <TabsList>
              <TabsTrigger value="before">Before</TabsTrigger>
              <TabsTrigger value="after">After</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </Card>
      <div className="grid gap-5 md:grid-cols-3">
        <Card className="p-5">{t('dev.raised')}</Card>
        <Card surface="inset" className="p-5">
          {t('dev.inset')}
        </Card>
        <Card surface="flat" className="p-5">
          {t('dev.flat')}
        </Card>
      </div>
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="text-[17.5px] font-bold">{t('dev.feedback')}</h2>
        <Skeleton className="h-6 w-1/2" />
        <Button variant="soft" className="self-start" onClick={() => toast.success(t('dev.toastText'))}>
          {t('dev.toast')}
        </Button>
      </Card>
    </div>
  );
}
