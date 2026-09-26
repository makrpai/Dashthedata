'use client';

import { Tabs as TabsPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/lib/util/cn';

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('nm-inset inline-flex items-center gap-1 rounded-[var(--radius-control)] p-1', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold text-fg-2 transition-colors duration-[80ms] hover:text-fg data-[state=active]:bg-base data-[state=active]:text-fg data-[state=active]:shadow-nm-raised-sm [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  );
}
