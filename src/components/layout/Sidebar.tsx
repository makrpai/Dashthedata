'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useCallback } from 'react';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/util/cn';
import { useUiStore } from '@/store/ui';
import { useNavIndicators } from './useNavIndicators';
import { LanguageSwitch } from './LanguageSwitch';
import { NAV_ITEMS, activeNavItem, type NavItem } from './nav';
import { ProjectSwitcher } from './ProjectSwitcher';
import { SidebarItem } from './SidebarItem';
import { ThemeSwitch } from './ThemeSwitch';

/** Moves focus between nav links with the arrow keys (17.1). */
function handleArrowKeys(e: React.KeyboardEvent<HTMLElement>) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
  const links = Array.from(e.currentTarget.querySelectorAll<HTMLAnchorElement>('[data-nav-item]'));
  const index = links.indexOf(document.activeElement as HTMLAnchorElement);
  if (index === -1) return;
  e.preventDefault();
  const next =
    e.key === 'Home'
      ? 0
      : e.key === 'End'
        ? links.length - 1
        : (index + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
  links[next]?.focus();
}

export function useSidebarCollapsed(): boolean {
  const pref = useUiStore((s) => s.sidebarCollapsed);
  const wide = useMediaQuery('(min-width: 1024px)', true);
  return pref ?? !wide;
}

export function SidebarContent({ mode, onNavigate }: { mode: 'rail' | 'drawer'; onNavigate?: () => void }) {
  const t = useT();
  const pathname = usePathname();
  const active = activeNavItem(pathname);
  const indicators = useNavIndicators();
  const collapsedState = useSidebarCollapsed();
  const collapsed = mode === 'rail' && collapsedState;
  const setCollapsed = useUiStore((s) => s.setSidebarCollapsed);

  const toggle = useCallback(() => {
    setCollapsed(!collapsed);
    document.documentElement.dataset.sidebar = collapsed ? 'expanded' : 'collapsed';
  }, [collapsed, setCollapsed]);

  const renderItem = (item: NavItem) => {
    const ind = indicators[item.id];
    return (
      <li key={item.id}>
        <SidebarItem
          href={item.href}
          icon={item.icon}
          label={t(item.label)}
          hint={item.id === 'transform' ? t('nav.transformHint') : undefined}
          active={active?.id === item.id}
          collapsed={collapsed}
          count={ind?.count}
          countLabel={ind?.countLabel}
          dot={ind?.dot}
          dotLabel={ind?.dotLabel}
          onNavigate={onNavigate}
        />
      </li>
    );
  };

  const group = (g: NavItem['group']) => NAV_ITEMS.filter((i) => i.group === g).map(renderItem);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-3 px-1">
        <Link
          href="/"
          className="flex h-9 items-center rounded-[8px] px-2"
          aria-label={t('nav.home')}
          onClick={onNavigate}
        >
          <span className="dtd-label">
            <Logo variant="horizontal" size={26} />
          </span>
          <Logo variant="mark" size={28} className="dtd-mark-only hidden" />
        </Link>
        <ProjectSwitcher collapsed={collapsed} />
      </div>
      <nav
        aria-label={t('nav.label')}
        onKeyDown={handleArrowKeys}
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-1"
      >
        <div className="flex flex-col gap-1">
          <p className="dtd-label px-3 text-[12px] font-semibold text-fg-2">{t('nav.groupProject')}</p>
          <ul className="flex flex-col gap-1">{group('project')}</ul>
        </div>
        <div className="flex flex-col gap-1">
          <p className="dtd-label px-3 text-[12px] font-semibold text-fg-2">{t('nav.groupTools')}</p>
          <ul className="flex flex-col gap-1">{group('tools')}</ul>
        </div>
        <ul className="mt-auto flex flex-col gap-1">{group('footer')}</ul>
      </nav>
      <div className="dtd-sidebar-footer flex items-center gap-1 px-1">
        <LanguageSwitch className="dtd-label" />
        <ThemeSwitch />
        {mode === 'rail' && (
          <Tooltip content={`${collapsed ? t('nav.expand') : t('nav.collapse')} ( [ )`} side="right">
            <Button
              variant="ghost"
              size="iconSm"
              className="ml-auto"
              onClick={toggle}
              aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
              aria-keyshortcuts="["
            >
              {collapsed ? <ChevronsRight aria-hidden /> : <ChevronsLeft aria-hidden />}
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

/** Desktop rail. Width is driven by CSS (html[data-sidebar] + viewport) so it never flashes. */
export function Sidebar() {
  return (
    <aside
      className={cn(
        'dtd-sidebar nm-raised sticky top-3 m-3 mr-0 hidden h-[calc(100vh-1.5rem)] shrink-0 flex-col rounded-[var(--radius-card)] p-3 md:flex',
      )}
    >
      <SidebarContent mode="rail" />
    </aside>
  );
}
