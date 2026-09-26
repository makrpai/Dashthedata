'use client';

import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { Check } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/util/cn';

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'nm-inset peer inline-flex size-5 shrink-0 items-center justify-center rounded-[6px] disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-fg',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
