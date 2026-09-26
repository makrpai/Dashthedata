'use client';

import {
  ArrowDownAZ,
  ArrowUpAZ,
  Calculator,
  ChevronDown,
  Filter,
  Pencil,
  Repeat,
  Replace,
  Scissors,
  Shapes,
  Trash2,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/lib/i18n/useT';
import type { ColumnProfile, ColumnRole, ColumnType } from '@/types/domain';

export type ColumnAction =
  | { kind: 'rename' | 'filter' | 'remove' | 'split' | 'replace' | 'calculated' | 'reinterpret' }
  | { kind: 'sort'; dir: 'asc' | 'desc' }
  | { kind: 'type'; to: ColumnType }
  | { kind: 'role'; to: ColumnRole };

const TYPES: ColumnType[] = ['text', 'integer', 'decimal', 'date', 'datetime', 'boolean'];
const ROLES: ColumnRole[] = ['measure', 'dimension', 'time', 'id', 'text'];

/** Column header menu (17.1): every action becomes a step in the log (or a role override). */
export function ColumnHeaderMenu({ column, onAction }: { column: ColumnProfile; onAction: (a: ColumnAction) => void }) {
  const t = useT();
  const ambiguous = column.warnings.some((w) => w.code === 'ambiguous_format');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="iconSm" className="size-6" aria-label={t('transform.columnMenu.label', { name: column.displayName })}>
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onSelect={() => onAction({ kind: 'rename' })}>
          <Pencil aria-hidden />
          {t('transform.columnMenu.rename')}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Type aria-hidden />
            {t('transform.columnMenu.changeType')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={column.type} onValueChange={(v) => onAction({ kind: 'type', to: v as ColumnType })}>
              {TYPES.map((ty) => (
                <DropdownMenuRadioItem key={ty} value={ty}>
                  {t.dynamic(`profile.type.${ty}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Shapes aria-hidden />
            {t('transform.columnMenu.changeRole')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={column.role} onValueChange={(v) => onAction({ kind: 'role', to: v as ColumnRole })}>
              {ROLES.map((r) => (
                <DropdownMenuRadioItem key={r} value={r}>
                  {t.dynamic(`profile.role.${r}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {ambiguous && (
          <DropdownMenuItem onSelect={() => onAction({ kind: 'reinterpret' })}>
            <Repeat aria-hidden />
            {t('transform.columnMenu.reinterpret')}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onAction({ kind: 'sort', dir: 'asc' })}>
          <ArrowUpAZ aria-hidden />
          {t('transform.columnMenu.sortAsc')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction({ kind: 'sort', dir: 'desc' })}>
          <ArrowDownAZ aria-hidden />
          {t('transform.columnMenu.sortDesc')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction({ kind: 'filter' })}>
          <Filter aria-hidden />
          {t('transform.columnMenu.filter')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction({ kind: 'split' })}>
          <Scissors aria-hidden />
          {t('transform.columnMenu.split')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction({ kind: 'replace' })}>
          <Replace aria-hidden />
          {t('transform.columnMenu.replace')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction({ kind: 'calculated' })}>
          <Calculator aria-hidden />
          {t('transform.columnMenu.calculated')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => onAction({ kind: 'remove' })}>
          <Trash2 aria-hidden />
          {t('transform.columnMenu.remove')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
