'use client';

import { Contrast, Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/lib/i18n/useT';
import { useUiStore, type ContrastPref, type ThemePref } from '@/store/ui';

export function ThemeSwitch() {
  const t = useT();
  const theme = useUiStore((s) => s.theme);
  const contrast = useUiStore((s) => s.contrast);
  const setTheme = useUiStore((s) => s.setTheme);
  const setContrast = useUiStore((s) => s.setContrast);
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="iconSm" aria-label={t('theme.toggle')}>
          <Icon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuLabel>{t('theme.label')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemePref)}>
          <DropdownMenuRadioItem value="light">{t('theme.light')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">{t('theme.dark')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">{t('theme.system')}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-1.5">
          <Contrast className="size-3.5" aria-hidden />
          {t('theme.contrast')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={contrast} onValueChange={(v) => setContrast(v as ContrastPref)}>
          <DropdownMenuRadioItem value="normal">{t('theme.contrastNormal')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="high">{t('theme.contrastHigh')}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
