'use client';

import { Switch as SwitchPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/lib/util/cn';

/** Track is inset; the thumb is raised and turns navy when on. */
export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'nm-inset peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-[18px] rounded-full border-[length:var(--line-w)] border-line-strong bg-base shadow-nm-raised-sm transition-transform duration-150 data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary" />
    </SwitchPrimitive.Root>
  );
}
