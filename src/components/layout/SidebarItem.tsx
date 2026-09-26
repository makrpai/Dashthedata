'use client';

import Link from 'next/link';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/util/cn';
import type { LucideIcon } from 'lucide-react';

export interface SidebarItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  /** Shows the label in a tooltip (collapsed rail). */
  collapsed: boolean;
  count?: number;
  countLabel?: string;
  dot?: 'accent' | 'success' | 'danger' | null;
  dotLabel?: string;
  hint?: string;
  onNavigate?: () => void;
}

/**
 * Active item: pressed surface, text colour, weight 600 and a 3 px accent bar on the left,
 * so the state never relies on the shadow alone (17.1).
 */
export function SidebarItem({
  href,
  icon: Icon,
  label,
  active,
  collapsed,
  count,
  countLabel,
  dot,
  dotLabel,
  hint,
  onNavigate,
}: SidebarItemProps) {
  const link = (
    <Link
      href={href}
      data-nav-item
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      onClick={onNavigate}
      className={cn(
        'relative flex h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-[14px] outline-offset-2 transition-colors duration-[80ms]',
        active
          ? 'nm-pressed font-semibold text-fg'
          : 'border-[length:var(--line-w)] border-transparent font-medium text-fg-2 hover:text-fg',
      )}
    >
      {active && (
        <span aria-hidden className="absolute top-2 bottom-2 -left-px w-[3px] rounded-full bg-accent" />
      )}
      <Icon className={cn('size-[18px] shrink-0', active ? 'text-fg' : 'text-slate')} aria-hidden />
      <span className="dtd-label min-w-0 flex-1 truncate">
        {label}
        {hint && <span className="ml-1 text-[12px] font-normal text-fg-2">{hint}</span>}
      </span>
      {typeof count === 'number' && count > 0 && (
        <span className="dtd-label tabular text-[12px] font-semibold text-fg-2" aria-label={countLabel}>
          {count}
        </span>
      )}
      {dot && (
        <span
          role="status"
          aria-label={dotLabel}
          className={cn(
            'size-2 shrink-0 rounded-full',
            dot === 'accent' && 'bg-accent',
            dot === 'success' && 'bg-success',
            dot === 'danger' && 'bg-danger',
            'dtd-dot',
          )}
        />
      )}
    </Link>
  );
  return collapsed ? (
    <Tooltip content={label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}
