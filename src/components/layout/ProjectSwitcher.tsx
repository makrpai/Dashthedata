'use client';

import { ChevronsUpDown, FolderInput, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/util/cn';
import { useProjectStore } from '@/store';
import { useProjectActions } from './useProjectActions';

export function ProjectSwitcher({ collapsed }: { collapsed: boolean }) {
  const t = useT();
  const project = useProjectStore((s) => s.project);
  const { projects, openProject, newProject, importProject, renameProject, duplicateProject, deleteProject } = useProjectActions();
  const name = project?.name ?? t('project.untitled');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="soft"
          size={collapsed ? 'icon' : 'md'}
          className={cn('w-full justify-between', collapsed && 'mx-auto w-9')}
          aria-label={`${t('project.switcher')}: ${name}`}
        >
          {!collapsed && <span className="truncate">{name}</span>}
          <ChevronsUpDown className="text-slate" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {projects.length > 0 && (
          <>
            <DropdownMenuLabel>{t('project.recent')}</DropdownMenuLabel>
            {projects.slice(0, 8).map((p) => (
              <DropdownMenuItem key={p.id} onSelect={() => openProject(p.id)}>
                <span className={cn('truncate', p.id === project?.id && 'font-semibold')}>{p.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={() => newProject()}>
          <FolderPlus aria-hidden />
          {t('project.newProject')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => importProject()}>
          <FolderInput aria-hidden />
          {t('project.importProject')}
        </DropdownMenuItem>
        {project && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void renameProject()}>{t('common.rename')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void duplicateProject(project.id)}>{t('common.duplicate')}</DropdownMenuItem>
            <DropdownMenuItem destructive onSelect={() => void deleteProject(project.id, project.name)}>
              {t('common.delete')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
