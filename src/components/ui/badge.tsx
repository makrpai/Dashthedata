import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/util/cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold border-[length:var(--line-w)] whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-line-strong text-fg bg-surface',
        accent: 'border-accent text-accent-fg bg-transparent',
        success: 'border-success text-success bg-transparent',
        danger: 'border-danger text-danger bg-transparent',
        muted: 'border-line text-fg-2 bg-transparent',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
