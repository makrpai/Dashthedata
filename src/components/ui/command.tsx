'use client';

import { Command as CommandPrimitive } from 'cmdk';
import { Search } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/util/cn';

export function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive className={cn('flex w-full flex-col overflow-hidden text-fg', className)} {...props} />
  );
}

export function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="nm-inset mb-1.5 flex items-center gap-2 rounded-[var(--radius-control)] px-3">
      <Search className="size-4 text-slate" aria-hidden />
      <CommandPrimitive.Input
        className={cn(
          'h-9 w-full bg-transparent text-[14px] outline-none placeholder:text-fg-2/80',
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List className={cn('max-h-72 overflow-y-auto', className)} {...props} />;
}

export function CommandEmpty(props: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty className="py-4 text-center text-[13px] text-fg-2" {...props} />;
}

export function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-fg-2',
        className,
      )}
      {...props}
    />
  );
}

export function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        'flex cursor-default select-none items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[14px] outline-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] [&_svg]:size-4 [&_svg]:text-slate',
        className,
      )}
      {...props}
    />
  );
}
