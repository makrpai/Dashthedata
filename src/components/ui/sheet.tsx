'use client';

import { Dialog as SheetPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/util/cn';

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;
export const SheetDescription = SheetPrimitive.Description;

/** Side panel. Slides in from the left (mobile navigation) or right (editors). */
export function SheetContent({
  side = 'right',
  className,
  children,
  closeLabel,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: 'left' | 'right'; closeLabel: string }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--brand-ink)_40%,transparent)]" />
      <SheetPrimitive.Content
        className={cn(
          'fixed top-0 z-50 flex h-full flex-col gap-4 overflow-y-auto bg-base p-5 shadow-nm-raised focus:outline-none',
          'border-line [border-width:var(--line-w)]',
          side === 'left' ? 'left-0 w-[min(20rem,85vw)]' : 'right-0 w-[min(28rem,95vw)]',
          'transition-transform duration-150',
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          className="absolute top-4 right-4 rounded-full p-1 text-fg-2 hover:text-fg"
          aria-label={closeLabel}
        >
          <X className="size-4" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
