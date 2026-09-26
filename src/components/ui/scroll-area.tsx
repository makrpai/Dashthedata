'use client';

import { ScrollArea as ScrollPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/lib/util/cn';

export function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ScrollPrimitive.Root>) {
  return (
    <ScrollPrimitive.Root className={cn('relative overflow-hidden', className)} {...props}>
      <ScrollPrimitive.Viewport className="size-full rounded-[inherit]">{children}</ScrollPrimitive.Viewport>
      <ScrollPrimitive.Scrollbar orientation="vertical" className="flex w-2.5 touch-none p-0.5 select-none">
        <ScrollPrimitive.Thumb className="relative flex-1 rounded-full bg-slate/50" />
      </ScrollPrimitive.Scrollbar>
      <ScrollPrimitive.Scrollbar
        orientation="horizontal"
        className="flex h-2.5 touch-none flex-col p-0.5 select-none"
      >
        <ScrollPrimitive.Thumb className="relative flex-1 rounded-full bg-slate/50" />
      </ScrollPrimitive.Scrollbar>
      <ScrollPrimitive.Corner />
    </ScrollPrimitive.Root>
  );
}
