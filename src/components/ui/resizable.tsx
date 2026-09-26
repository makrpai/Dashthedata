'use client';

import { Group, Panel, Separator } from 'react-resizable-panels';
import * as React from 'react';
import { cn } from '@/lib/util/cn';

export const ResizablePanelGroup = Group;
export const ResizablePanel = Panel;

export function ResizableHandle({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      className={cn(
        'relative flex w-2 items-center justify-center after:h-10 after:w-1 after:rounded-full after:bg-line-strong hover:after:bg-slate focus-visible:outline-none aria-[orientation=horizontal]:h-2 aria-[orientation=horizontal]:w-full',
        className,
      )}
      {...props}
    />
  );
}
