import {
  CircleHelp,
  Cpu,
  Database,
  LayoutDashboard,
  MessageSquareText,
  Network,
  Plug,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { TKey } from '@/lib/i18n';

export type NavId =
  'dashboards' | 'data' | 'transform' | 'model' | 'ask' | 'integrations' | 'ai' | 'settings' | 'help';

export interface NavItem {
  id: NavId;
  href: string;
  /** Path prefix used to decide the active item. */
  match: string;
  icon: LucideIcon;
  label: TKey;
  group: 'project' | 'tools' | 'footer';
}

/** Sidebar items (17.1). Dashboards is first because users return there most often. */
export const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboards',
    href: '/workspace/dashboards',
    match: '/workspace/dashboards',
    icon: LayoutDashboard,
    label: 'nav.dashboards',
    group: 'project',
  },
  {
    id: 'data',
    href: '/workspace/data',
    match: '/workspace/data',
    icon: Database,
    label: 'nav.data',
    group: 'project',
  },
  {
    id: 'transform',
    href: '/workspace/transform',
    match: '/workspace/transform',
    icon: Sparkles,
    label: 'nav.transform',
    group: 'project',
  },
  {
    id: 'model',
    href: '/workspace/model',
    match: '/workspace/model',
    icon: Network,
    label: 'nav.model',
    group: 'project',
  },
  {
    id: 'ask',
    href: '/workspace/ask',
    match: '/workspace/ask',
    icon: MessageSquareText,
    label: 'nav.ask',
    group: 'tools',
  },
  {
    id: 'integrations',
    href: '/workspace/integrations',
    match: '/workspace/integrations',
    icon: Plug,
    label: 'nav.integrations',
    group: 'tools',
  },
  { id: 'ai', href: '/workspace/ai', match: '/workspace/ai', icon: Cpu, label: 'nav.ai', group: 'tools' },
  {
    id: 'settings',
    href: '/workspace/settings',
    match: '/workspace/settings',
    icon: Settings,
    label: 'nav.settings',
    group: 'footer',
  },
  {
    id: 'help',
    href: '/workspace/help',
    match: '/workspace/help',
    icon: CircleHelp,
    label: 'nav.help',
    group: 'footer',
  },
];

export function activeNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname === item.match || pathname.startsWith(`${item.match}/`));
}
